// Author:Melody.Hu
// Title:Chinese Style Mei Flower

#ifdef GL_ES
precision mediump float;
#endif

#define PI 3.14159265359
#define _PerlinPrecision 8.0
#define _PerlinOctaves 8.0
#define _PerlinSeed 0.0

#define BRANCH_COUNT 200
#define MAX_FALLING 32

uniform vec2 u_resolution;
uniform sampler2D u_wall;
// Posed skeleton from tree.js.
// u_segA: branch start, end of its first segment.
// u_segB: end of its second segment, sway angle, cull radius.
// u_rest: branch start in the rest pose, flower sway angle,
//         flower state packed as 2 * (bitmask of shed petals) + bloom.
uniform vec4 u_segA[BRANCH_COUNT];
uniform vec4 u_segB[BRANCH_COUNT];
uniform vec4 u_rest[BRANCH_COUNT];
// Falling petals from tree.js.
// u_fallA: rest start of the petal's flower, flower index, petal index.
// u_fallB: position, rotation, squash. u_fallC: petal offset inside its flower, active flag.
uniform vec4 u_fallA[MAX_FALLING];
uniform vec4 u_fallB[MAX_FALLING];
uniform vec4 u_fallC[MAX_FALLING];

vec2 rosegraph(float R, float k, float t) {
    vec2 pos;
    pos.x = R * cos(k * t) * cos(t);
    pos.y = R * cos(k * t) * sin(t);
    return pos;
}

float segmentDistance(in vec2 p, in vec2 a, in vec2 b) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}

float segment(in vec2 p, in vec2 a, in vec2 b, in float weight) {
    return step(segmentDistance(p, a, b), weight);
}

vec2 rotate(vec2 v, float angle) {
    float c = cos(angle), s = sin(angle);
    return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}

mat2 rotate2d(float _angle) {
    return mat2(cos(_angle), -sin(_angle), sin(_angle), cos(_angle));
}

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float remap(float value, float min1, float max1, float min2, float max2) {
    return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
}

//perlin noise paramter
vec4 mod289(vec4 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x) {
    return mod289(((x * 34.0) + 10.0) * x);
}

vec4 taylorInvSqrt(vec4 r) {
    return 1.79284291400159 - 0.85373472095314 * r;
}

vec2 fade(vec2 t) {
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

// Classic Perlin noise
float perlin(vec2 P) {
    vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
    vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
    Pi = mod289(Pi); // To avoid truncation effects in permutation
    vec4 ix = Pi.xzxz;
    vec4 iy = Pi.yyww;
    vec4 fx = Pf.xzxz;
    vec4 fy = Pf.yyww;

    vec4 i = permute(permute(ix) + iy);

    vec4 gx = fract(i * (1.0 / 41.0)) * 2.0 - 1.0;
    vec4 gy = abs(gx) - 0.5;
    vec4 tx = floor(gx + 0.5);
    gx = gx - tx;

    vec2 g00 = vec2(gx.x, gy.x);
    vec2 g10 = vec2(gx.y, gy.y);
    vec2 g01 = vec2(gx.z, gy.z);
    vec2 g11 = vec2(gx.w, gy.w);

    vec4 norm = taylorInvSqrt(vec4(dot(g00, g00), dot(g01, g01), dot(g10, g10), dot(g11, g11)));
    g00 *= norm.x;
    g01 *= norm.y;
    g10 *= norm.z;
    g11 *= norm.w;

    float n00 = dot(g00, vec2(fx.x, fy.x));
    float n10 = dot(g10, vec2(fx.y, fy.y));
    float n01 = dot(g01, vec2(fx.z, fy.z));
    float n11 = dot(g11, vec2(fx.w, fy.w));

    vec2 fade_xy = fade(Pf.xy);
    vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
    float n_xy = mix(n_x.x, n_x.y, fade_xy.y);
    return 2.3 * n_xy;
}

//random
float random(float x) {
    return fract(sin(x) * 100.);
}

float random2D(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) *
        43758.5453123);
}

float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(random2D(i + vec2(0.0, 0.0)), random2D(i + vec2(1.0, 0.0)), u.x), mix(random2D(i + vec2(0.0, 1.0)), random2D(i + vec2(1.0, 1.0)), u.x), u.y);
}

// Branch widths and the ring pattern are sampled in each branch's rest pose,
// so the bark travels with the branch instead of sliding under it.
float fractalTree(vec2 st) {
    float alpha = 0.0;

    for(int i = 0; i < BRANCH_COUNT; i++) {
        vec4 a = u_segA[i];
        vec4 b = u_segB[i];
        float d1 = segmentDistance(st, a.xy, a.zw);
        float d2 = segmentDistance(st, a.zw, b.xy);
        if(min(d1, d2) > b.w) {
            continue;
        }

        vec2 restSt = u_rest[i].xy + rotate(st - a.xy, -b.z);

        // every ancestor thins the branch with its own noise
        float weight = 0.027;
        int n = i;
        for(int g = 0; g < 12; g++) {
            if(n == 0) {
                break;
            }
            int k = (n - 1) / 3;
            int r = (n - 1) - 3 * k;
            n = 2 * k + (r - r / 2);
            float ancestorNoise = noise(restSt * float(72 - n) * 0.8);
            weight *= (ancestorNoise * 0.2 + 0.85) * (ancestorNoise * 0.1 + 0.9) * 0.9;
        }

        float weightNoise = noise(restSt * float(72 - i) * 0.8);
        weight *= weightNoise * 0.2 + 0.85;
        float covered = step(d1, weight);
        weight *= weightNoise * 0.1 + 0.9;
        covered += step(d2, weight);

        if(covered > 0.) {
            float pattern = smoothstep(0., 0.1, fract((1. - noise(restSt * 30.)) * 5.));
            alpha += covered * pow(pattern, float(BRANCH_COUNT - i));
        }
    }
    return alpha;
}

// shed: bitmask of petals that have fallen off.
// only: draw just this petal and no pistil, or every petal when negative.
// bloom: 0 to 1, the bud swells first, then its petals fan out into the open flower.
vec4 flower(vec2 st, vec2 pos, float hue, float size, float index, float shed, float only, float bloom) {
    vec4 folowerColor = vec4(0.0);
    vec4 pistilColor = vec4(0.0);
    float pistilAlpha = 0.0;
    vec4 petalColor = vec4(0.0);
    float petalAlpha = 0.;
    vec2 centerPoint = vec2(0.0, 0.0);
    float petalNum = 5.;
    float petalNoise = perlin(st * 40.);

    float petalBit = 1.;

    float open = 1.;
    float petalRadius = size; //petal size
    float petalDis = 0.013; //petal to center distance
    float slim = 0.7;
    float wobble = 0.01;
    float baseSaturate = 0.8;
    float tipSaturate = 0.2;
    float light = 0.5;
    float lightBase = 0.7;
    float pistilGrow = 1.;
    if(bloom < 1.) {
        //a closed flower is the same fan of slim petals as a bud
        open = smoothstep(0.35, 1., bloom);
        petalRadius = size * mix(0.75, 1., open) * smoothstep(0., 0.3, bloom);
        petalDis = 0.013 * open;
        slim = mix(0.6, 0.7, open);
        wobble = 0.01 * open;
        baseSaturate = mix(0.95, 0.8, open);
        tipSaturate = mix(0.45, 0.2, open);
        light = mix(0.2, 0.5, open);
        lightBase = mix(0.9, 0.7, open);
        pistilGrow = smoothstep(0.5, 1., open);
    }

    mat2 startRot = rotate2d(PI * random(index) * 2.);
    pos *= startRot;

    //draw one flower
    for(float i = 0.; i < 5.; i++) {
        float rotateAngle = (0.2 + random(i) * 0.1) * 2. * PI; //petal rotation//random(i)
        if(bloom < 1.) {
            rotateAngle = mix(0.07 * PI, rotateAngle, open);
        }
        mat2 rotMatrix = rotate2d(rotateAngle);
        pos *= rotMatrix;
        bool hasPetal = only < 0. ? mod(floor(shed / petalBit), 2.) == 0. : i == only;
        petalBit *= 2.;
        if(!hasPetal && only >= 0.) {
            continue;
        }

        pos -= vec2(petalDis, 0); //translate next petal dis from the center
        //draw one petal
        for(float j = 0.; j < PI; j += 0.1) {
            //draw lines to form petal
            vec2 endPoint = rosegraph(petalRadius, 1., j);
            endPoint.y *= slim; //make the petal slim 
            endPoint += vec2(petalNoise * wobble); //make the petal shape has more dynamic shape
            if(hasPetal) {
                petalAlpha = segment(pos, centerPoint, endPoint, 0.005);
                //use point on petal to do color manipulation
                float dis = distance(pos, centerPoint);
                float r = distance(centerPoint, endPoint);
                petalAlpha *= petalNoise * 0.2 + 0.9;//alpha variation 
                float saturate = remap(dis, 0.0, r, baseSaturate, tipSaturate) - petalNoise * 0.3;
                float brightness = petalNoise * light + lightBase;
                vec3 c = vec3(hue, saturate, brightness);
                c = hsv2rgb(c);
                vec4 petalLine = vec4(c, petalAlpha);
                petalColor = mix(petalColor, petalLine, petalAlpha);
            }
            //define the pistil details
            if(only < 0. && pistilGrow > 0. && mod(j, 0.3) == 0.) {
                float pistilNoise = random2D(vec2(i, j));
                vec2 pistil = endPoint * (pistilNoise * 0.5 + 0.3) * pistilGrow; //the pistil size 
                pistil.y *= 2.;
                vec2 pistilPos = pos + vec2(petalDis, 0);
                pistilAlpha = segment(pistilPos, centerPoint, pistil, 0.001);
                vec3 hsvPistil = vec3(pistilNoise * 0.2, pistilNoise, 0.7);
                hsvPistil = hsv2rgb(hsvPistil);
                vec4 pistilLine = vec4(hsvPistil, pistilAlpha);
                pistilColor = mix(pistilColor, pistilLine, pistilAlpha);
            }

            if(pistilColor.a > 0.) {
                folowerColor = pistilColor;
            } else {
                folowerColor = petalColor;
            }
        }
        pos += vec2(petalDis, 0); //translate back to the origin    
    }

    return folowerColor;
}

vec4 bud(vec2 st, vec2 pos, float hue, float size, float index) {
    vec4 folowerColor = vec4(0.0);
    vec4 petalColor = vec4(0.0);
    float petalAlpha = 0.;
    vec2 centerPoint = vec2(0.0, 0.0);
    float petalNoise = perlin(st * 30.);

    mat2 startRot = rotate2d(PI * random(index) * 2.);
    pos *= startRot;

    for(float i = 0.; i < 3.; i++) {
        float rotateAngle = 0.1 * PI; //petal rotation
        mat2 rotMatrix = rotate2d(rotateAngle);
        pos *= rotMatrix;
        float petalRadius = size; //petal size

        //draw one petal
        for(float j = 0.; j < PI; j += 0.1) {
            //draw lines to form petal
            vec2 endPoint = rosegraph(petalRadius, 1., j);
            endPoint.y *= 0.6; //make the petal slim 
            // endPoint += vec2(petalNoise*0.01); //make the petal shape has more dynamic shape
            petalAlpha = segment(pos, centerPoint, endPoint, 0.005);
            //use point on petal to do color manipulation
            float dis = distance(pos, centerPoint);
            float r = distance(centerPoint, endPoint);
            petalAlpha *= petalNoise * 0.2 + 0.9;//alpha variation petalNoise*0.2+0.9
            float saturate = remap(dis, 0.0, r, 0.7, 0.2) - petalNoise * 0.3;
            float brightness = petalNoise * 0.2 + 0.9;
            vec3 c = vec3(hue, saturate, brightness);
            c = hsv2rgb(c);
            vec4 petalLine = vec4(c, petalAlpha);
            petalColor = mix(petalColor, petalLine, petalAlpha);
            folowerColor = petalColor;
        }

    }

    return folowerColor;
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    vec4 bgColor = texture2D(u_wall, vec2(st.x, 1. - st.y));
    //tree
    vec4 treeColor = vec4(vec3(0.0), fractalTree(st));

    //flower
    vec4 finalColor = mix(bgColor, treeColor, treeColor.a);
    vec4 flowerColor = vec4(0.);

    for(int i = 16; i < BRANCH_COUNT; i++) {
        float index = float(i);
        bool isFlower = mod(index, 5.) == 0.;
        bool isBud = !isFlower && mod(index, 7.) == 0.;
        float shed = floor(u_rest[i].w / 2.);
        float bloom = u_rest[i].w - 2. * shed;
        //a flower that budded later on a spot that started out empty, it sits right on the branch
        bool isLate = !isFlower && !isBud && bloom > 0.;

        if(isFlower || isBud || isLate) {
            vec4 color = vec4(0.);
            vec2 restPos = u_rest[i].xy;
            float flowerSize = random(index) * 0.02 + 0.016;
            float reach = flowerSize + 0.045;
            vec2 toNode = st - u_segA[i].xy;

            if((isBud || bloom > 0.) && length(toNode) < reach + 0.071) {
                vec2 offset = isFlower ? (vec2(random(restPos.x), random(restPos.y)) - 0.5) * 0.1 : vec2(0.);
                vec2 toCenter = toNode - rotate(offset, u_segB[i].z);

                if(length(toCenter) < reach) {
                    // back to the rest pose, so petal shape and gloss stay with the flower
                    vec2 pos = rotate(toCenter, -u_rest[i].z);
                    vec2 restSt = restPos + offset + pos;
                    float flowerHue = remap(random2D(restPos), 0., 1.0, 0.92, 1.);
                    // every whole flower goes through this one call: a second call site
                    // elsewhere in the shader makes the frame several times slower
                    if(isBud) {
                        color = bud(restSt, pos, flowerHue, flowerSize, index);
                    } else {
                        color = flower(restSt, pos, flowerHue, flowerSize, index, shed, -1., bloom);
                    }
                }
            }
            if(isLate) {
                for(int layer = 0; layer < 3; layer++) {
                    finalColor = mix(finalColor, color, color.a);
                }
            } else {
                flowerColor = color;
            }
        }
        finalColor = mix(finalColor, flowerColor, flowerColor.a);
    }

    //falling petals, each one is a petal of its flower carried along rigidly
    for(int i = 0; i < MAX_FALLING; i++) {
        vec4 petal = u_fallB[i];
        float petalSize = random(u_fallA[i].z) * 0.02 + 0.016;
        vec2 toPetal = st - petal.xy;
        if(u_fallC[i].z < 0.5 || length(toPetal) > petalSize * 0.5 + 0.03) {
            continue;
        }
        vec2 restPos = u_fallA[i].xy;
        vec2 offset = mod(u_fallA[i].z, 5.) == 0. ? (vec2(random(restPos.x), random(restPos.y)) - 0.5) * 0.1 : vec2(0.);
        vec2 local = rotate(toPetal, -petal.z);
        local.y /= petal.w; //the squash makes the petal flip as it tumbles
        vec2 pos = u_fallC[i].xy + local;
        float petalHue = remap(random2D(restPos), 0., 1.0, 0.92, 1.);
        vec4 petalColor = flower(restPos + offset + pos, pos, petalHue, petalSize, u_fallA[i].z, 0., u_fallA[i].w, 1.);
        //flowers are composited several times over, so match their opacity
        for(int layer = 0; layer < 3; layer++) {
            finalColor = mix(finalColor, petalColor, petalColor.a);
        }
    }

    gl_FragColor = finalColor;
}
