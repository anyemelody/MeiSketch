// Author:Melody.Hu
// Title:Mei Flower with Pattern Tree

#ifdef GL_ES
precision mediump float;
#endif

#define PI 3.14159265359
#define _PerlinPrecision 8.0
#define _PerlinOctaves 8.0
#define _PerlinSeed 0.0

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;


vec2 rosegraph(float R, float k, float t){
    vec2 pos;
    pos.x = R*cos(k*t)*cos(t);
    pos.y = R*cos(k*t)*sin(t);
    return pos;
}

float lines(in vec2 pos, float b){
    float scale = 10.0;
    pos *= scale;
    return smoothstep(0.0,
                    .5+b*.5,
                    abs((sin(pos.x*3.1415)+b*2.0))*.5);
}

float segment( in vec2 p, in vec2 a, in vec2 b, in float weight)
{
    vec2 pa = p-a, ba = b-a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
    return step(length( pa - ba*h ), weight);
}

mat2 rotate2d(float _angle){
    return mat2(cos(_angle),-sin(_angle),
                sin(_angle),cos(_angle));
}

vec3 hsv2rgb(vec3 c)
{
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float remap(float value, float min1, float max1, float min2, float max2) {
  return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
}

//perlin noise paramter
vec4 mod289(vec4 x)
{
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x)
{
  return mod289(((x*34.0)+10.0)*x);
}

vec4 taylorInvSqrt(vec4 r)
{
  return 1.79284291400159 - 0.85373472095314 * r;
}

vec2 fade(vec2 t) {
  return t*t*t*(t*(t*6.0-15.0)+10.0);
}

// Classic Perlin noise
float perlin(vec2 P)
{
  vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
  vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
  Pi = mod289(Pi); // To avoid truncation effects in permutation
  vec4 ix = Pi.xzxz;
  vec4 iy = Pi.yyww;
  vec4 fx = Pf.xzxz;
  vec4 fy = Pf.yyww;

  vec4 i = permute(permute(ix) + iy);

  vec4 gx = fract(i * (1.0 / 41.0)) * 2.0 - 1.0 ;
  vec4 gy = abs(gx) - 0.5 ;
  vec4 tx = floor(gx + 0.5);
  gx = gx - tx;

  vec2 g00 = vec2(gx.x,gy.x);
  vec2 g10 = vec2(gx.y,gy.y);
  vec2 g01 = vec2(gx.z,gy.z);
  vec2 g11 = vec2(gx.w,gy.w);

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
float random (float x) {
    return fract(sin(x)*100.);
}


float random2D (vec2 st) {
    return fract(sin(dot(st.xy,
                         vec2(12.9898,78.233)))*
        43758.5453123);
}


vec2 random2(vec2 st){
    st = vec2( dot(st,vec2(127.1,311.7)),
              dot(st,vec2(269.5,183.3)) );
    return -1.0 + 2.0*fract(sin(st)*43758.5453123);
}


float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    vec2 u = f*f*(3.0-2.0*f);
    return mix( mix( random2D( i + vec2(0.0,0.0) ),
                     random2D( i + vec2(1.0,0.0) ), u.x),
                mix( random2D( i + vec2(0.0,1.0) ),
                     random2D( i + vec2(1.0,1.0) ), u.x), u.y);
}



struct Branch{
     vec2 st;
     float length;
     float angle;
     vec2 startPos;
     float weight;
     vec3 treeColor;
     float alpha;
 };

Branch stack[200];



vec4 fractalTree(vec2 st, float length, float angle, vec2 startPos, float weight, vec3 treeColor, float alpha){
    
    stack[0] = Branch(st, length, angle, startPos, weight, treeColor, alpha);
   
    for(int i = 0; i<200; i++){
        Branch b = stack[i];
        float weightNoise = noise(st*float(72-i)*0.8);
        vec2 distance = vec2(cos(b.angle), sin(b.angle))*b.length;
        b.weight *= weightNoise*0.2+0.85;
        vec2 endPos1 = b.startPos+distance;
        alpha += segment(st, b.startPos, endPos1, b.weight);

        float angleNoise = (random(float(i))-0.5)*0.2*PI;
        vec2 distance2 = vec2(cos(b.angle+angleNoise), sin(b.angle+angleNoise))*b.length;
        b.weight *= weightNoise*0.1+0.9;
        vec2 endPos2 = endPos1+distance2;
        alpha += segment(st, endPos1, endPos2, b.weight);
        alpha *= smoothstep(0., 0.1, fract((1.-noise(st*30.))*5.));
        
        if(mod(float(i),2.) == 0.){
            startPos = endPos1;
            float length = b.length*(random(float(i))*0.8+0.5);
            weight = b.weight*0.9;
            float angle = b.angle + (random2D(startPos)-random(float(i)))*0.2*PI;
            stack[i+1+i/2] = Branch(st, length, angle, startPos, weight, treeColor, alpha);          
        }
        else{
             startPos = endPos2;
            float length1 = b.length*(random(float(i)*0.5)*0.75+0.5);
            float length2 = b.length*(random2D(startPos)*1.+0.5);
        
           weight = b.weight*0.9;

        float angle1 = b.angle*sign(-b.angle)+random(float(i))*0.3*PI; //tweak the startPos times
        float angle2 = b.angle-random2D(startPos)*0.24*PI; //tweak the i times
        
        stack[(i+1)/2+i] = Branch(st, length1, angle1, startPos, weight, treeColor, alpha);
        stack[(i+1)/2+i+1] = Branch(st, length2, angle2, startPos, weight, treeColor, alpha);  
        }
    }
        vec4 c = vec4(treeColor, alpha);
       return c;
}


vec4 flower(vec2 st, vec2 pos, float hue, float size, float index){
    vec4 folowerColor = vec4(0.0);
    vec4 pistilColor = vec4(0.0);
    float pistilAlpha = 0.0;
    vec4 petalColor = vec4(0.0);
    float petalAlpha = 0.;
    vec2 centerPoint = vec2(0.0, 0.0);
    float petalNum = 5.;
    
     mat2 startRot = rotate2d(PI*random(index)*2.);
     pos *= startRot;
    
    
    //draw one flower
    for(float i=0.; i<5.; i++){
        float rotateAngle = (0.2+random(i)*0.05)*2.*PI; //petal rotation
        mat2 rotMatrix = rotate2d(rotateAngle);
        pos *= rotMatrix;
        float petalRadius = size; //petal size
        float petalDis = 0.013; //petal to center distance
        
        pos -= vec2(petalDis, 0); //translate next petal dis from the center
        //draw one petal
        for(float j=0.; j<PI; j+=0.1){
            //draw lines to form petal
            vec2 endPoint = rosegraph(petalRadius, 1., j);
            float petalNoise = perlin(st*40.);
            endPoint.y *=0.7; //make the petal slim 
            endPoint += vec2(petalNoise*0.01); //make the petal shape has more dynamic shape
            petalAlpha = segment(pos, centerPoint, endPoint, 0.005);
            //use point on petal to do color manipulation
            float dis = distance(pos,centerPoint);
            float r = distance(centerPoint, endPoint);
            petalAlpha *= petalNoise*0.2+0.9;//alpha variation petalNoise*0.2+0.9
            float saturate = remap(dis, 0.0, r, 0.7, 0.2)-petalNoise*0.3;
            float brightness = petalNoise*0.2+0.9; 
            vec3 c = vec3(hue, saturate, brightness);
            c = hsv2rgb(c);
            vec4 petalLine = vec4(c, petalAlpha);
            petalColor = mix(petalColor, petalLine, petalAlpha);
            //define the pistil details
            if(mod(j,0.3) == 0.){
                float pistilNoise = random2D(vec2(i,j));
                vec2 pistil = endPoint*(pistilNoise*0.5+0.3); //the pistil size 
                pistil.y *= 2.; 
                vec2 pistilPos = pos + vec2(petalDis, 0);
                pistilAlpha = segment(pistilPos, centerPoint, pistil, 0.001);
                vec3 hsvPistil = vec3(pistilNoise*0.2,pistilNoise,0.6);
                hsvPistil = hsv2rgb(hsvPistil);
                vec4 pistilLine = vec4(hsvPistil, pistilAlpha);
                pistilColor = mix(pistilColor, pistilLine, pistilAlpha);
            }
            
            if(pistilColor.a > 0.){
                folowerColor = pistilColor;
            }else{
                folowerColor = petalColor;
            }
        }  
        pos += vec2(petalDis, 0); //translate back to the origin    
    }
    
    return folowerColor;
}


vec4 bud(vec2 st, vec2 pos, float hue, float size, float index){
    vec4 folowerColor = vec4(0.0);
    vec4 petalColor = vec4(0.0);
    float petalAlpha = 0.;
    vec2 centerPoint = vec2(0.0, 0.0);
    
     mat2 startRot = rotate2d(PI*random(index)*2.);
     pos *= startRot;
    
    for(float i=0.; i<3.; i++){
        float rotateAngle = 0.1*PI; //petal rotation
        mat2 rotMatrix = rotate2d(rotateAngle);
        pos *= rotMatrix;
        float petalRadius = size; //petal size


        //draw one petal
        for(float j=0.; j<PI; j+=0.1){
            //draw lines to form petal
            vec2 endPoint = rosegraph(petalRadius, 1., j);
            float petalNoise = perlin(st*30.);
            endPoint.y *=0.6; //make the petal slim 
            // endPoint += vec2(petalNoise*0.01); //make the petal shape has more dynamic shape
            petalAlpha = segment(pos, centerPoint, endPoint, 0.005);
            //use point on petal to do color manipulation
            float dis = distance(pos,centerPoint);
            float r = distance(centerPoint, endPoint);
            petalAlpha *= petalNoise*0.2+0.9;//alpha variation petalNoise*0.2+0.9
            float saturate = remap(dis, 0.0, r, 0.7, 0.2)-petalNoise*0.3;
            float brightness = petalNoise*0.2+0.9; 
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
    vec2 st = gl_FragCoord.xy/u_resolution.xy;
    vec4 bgColor = vec4(0.475,0.090,0.108,1.000);
    //tree
    vec4 treeColor = fractalTree(st, 0.14, PI*((-0.72)), vec2(1.), 0.027, vec3(0.013,0.060,0.020), 0.0);
   //flower
    vec4 finalColor = mix(bgColor, treeColor, treeColor.a);
    vec4 flowerColor = vec4(0.);

    for(float i = 16.; i < 200.; i++) {
        vec2 branchPos = stack[int(i)].startPos;
        float flowerHue = remap(random2D(branchPos), 0., 1.0, 0.92, 1.);
        float flowerSize = random(i) * 0.02 + 0.016;
        if(mod(i, 5.) == 0.) {
            vec2 pos = st - branchPos - vec2((random(branchPos.x) - 0.5), (random(branchPos.y) - 0.5)) * 0.1;

            flowerColor = flower(st, pos, flowerHue, flowerSize, i);
        } else if(mod(i, 7.) == 0.) {
            vec2 pos = st - branchPos;
            flowerColor = bud(st, pos, flowerHue, flowerSize, i);

        }
        finalColor = mix(finalColor, flowerColor, flowerColor.a);
    }
    

    gl_FragColor = finalColor;
}