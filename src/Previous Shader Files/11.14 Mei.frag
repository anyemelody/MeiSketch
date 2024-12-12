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


float segment(vec2 p, vec2 a, vec2 b, float w){
    vec2 pa = p-a, ba = b-a;
    float h = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.);
    return step(length( pa - ba*h), w);
}

vec2 rosegraph(float R, float k, float t){
    vec2 pos;
    pos.x = R*cos(k*t)*cos(t);
    pos.y = R*cos(k*t)*sin(t);
    return pos;
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


//perlin noise
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

 struct Branch{
     vec2 st;
     float length;
     float angle;
     vec2 startPos;
     float weight;
     vec3 treeColor;
     float alpha;
 };

Branch stack[72];



vec4 fractalTree(vec2 st, float length, float angle, vec2 startPos, float weight, vec3 treeColor, float alpha){
    
    stack[0] = Branch(st, length, angle, startPos, weight, treeColor, alpha);
   
    for(int i = 0; i<72; i++){
        Branch b = stack[i];
        vec2 distance = vec2(cos(b.angle), sin(b.angle))*b.length;
        b.weight *= perlin(st*float(i-30))*0.2+1.;
        vec2 endPos = b.startPos+distance;
        alpha += segment(st, b.startPos, endPos, b.weight);
        startPos = endPos;
        
        if(mod(float(i),2.) == 0.){
            float length = b.length*(random(float(i))*0.3+0.72);
            weight = b.weight*0.85;
            float angle = b.angle + (perlin(startPos*0.7)-random(float(i)))*0.3*PI;
            stack[i+1+i/2] = Branch(st, length, angle, startPos, weight, treeColor, alpha);          
        }
        else{
            float length1 = b.length*(random(float(i)*0.5)*0.3+0.8);
            float length2 = b.length*(perlin(startPos*0.8)*0.6+0.75);
        
           weight = b.weight*0.9;

        float angle1 = b.angle - (random(float(i)*0.2))*0.24*PI; //tweak the startPos times
        float angle2 = b.angle + (random(float(i)*0.7))*0.2*PI; //tweak the i times
        
        stack[(i+1)/2+i] = Branch(st, length1, angle1, startPos, weight, treeColor, alpha);
        stack[(i+1)/2+i+1] = Branch(st, length2, angle2, startPos, weight, treeColor, alpha);  
        }
    }
        vec4 c = vec4(treeColor, alpha);
       return c;
}


vec4 fullFlower(vec2 st, vec2 pos, float hue, float size){
    vec4 folowerColor = vec4(0.0);
    vec4 pistilColor = vec4(0.0);
    float pistilAlpha = 0.0;
    vec4 petalColor = vec4(0.0);
    float petalAlpha = 0.;
    vec2 centerPoint = vec2(0.0, 0.0);

    //draw one flower
    for(float i=0.; i < 5.; i++){
        float rotateAngle = (0.2+perlin(st)*0.1)*2.*PI; //petal rotation
        mat2 rotMatrix = rotate2d(rotateAngle);
        pos *= rotMatrix;
        float petalRadius = size+0.02*perlin(st*5.); //petal size 
        float petalDis = 0.02*(1.-perlin(st*1.)); //petal to center distance
        
        pos -= vec2(petalDis, 0); //translate next petal dis from the center
        //draw one petal
        for(float j=0.; j<PI; j+=0.1){
            //draw lines to form petal
            vec2 endPoint = rosegraph(petalRadius, 1., j);
            float petalNoise = perlin(st*30.);
            endPoint.y *=0.6; //make the petal slim 
            endPoint += vec2(petalNoise*0.01); //make the petal shape has more dynamic shape
            petalAlpha = segment(pos, centerPoint, endPoint, 0.005);
            //use point on petal to do color manipulation
            float dis = distance(pos,centerPoint);
            float saturate = remap(dis, 0.0, petalRadius, 0.6, 0.02)-perlin(st*40.)*0.1;
            float brightness = perlin(st*5.)*0.1+0.9;
            vec3 c = vec3(hue, saturate, brightness);
            c = hsv2rgb(c);
            vec4 petalLine = vec4(c, petalAlpha);
            petalColor = mix(petalColor, petalLine, petalAlpha);
            //define the pistil details
            if(mod(j,0.3) == 0.){
                vec2 pistil = endPoint*0.6; //the pistil size 
                pistil.y *= 2.; 
                vec2 pistilPos = pos + vec2(petalDis, 0);
                pistilAlpha = segment(pistilPos, centerPoint, pistil, ((1.-perlin(st*100.))*0.001));
                vec3 hsvPistil = vec3(hue,saturate,0.6);
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


vec4 petal(vec2 st, vec2 pos, float hue, float size){
    vec4 folowerColor = vec4(0.0);
    vec4 pistilColor = vec4(0.0);
    float pistilAlpha = 0.0;
    vec4 petalColor = vec4(0.0);
    float petalAlpha = 0.;
    vec2 centerPoint = vec2(0.0, 0.0);

    //draw one flower
        float rotateAngle = (0.2+perlin(st)*0.1)*2.*PI; //petal rotation
        mat2 rotMatrix = rotate2d(rotateAngle);
        pos *= rotMatrix;
        float petalRadius = size+0.02*perlin(st*5.); //petal size 
        float petalDis = 0.02*(1.-perlin(st*1.)); //petal to center distance
        
        pos -= vec2(petalDis, 0); //translate next petal dis from the center
        //draw one petal
        for(float j=0.; j<PI; j+=0.1){
            //draw lines to form petal
            vec2 endPoint = rosegraph(petalRadius, 1., j);
            float petalNoise = perlin(st*30.);
            endPoint.y *=0.6; //make the petal slim 
            endPoint += vec2(petalNoise*0.01); //make the petal shape has more dynamic shape
            petalAlpha = segment(pos, centerPoint, endPoint, 0.005);
            //use point on petal to do color manipulation
            float dis = distance(pos,centerPoint);
            float saturate = remap(dis, 0.0, petalRadius, 0.6, 0.05)-perlin(st*20.)*0.2;
            float brightness = perlin(st*5.)*0.1+0.9;
            vec3 c = vec3(hue, saturate, brightness);
            c = hsv2rgb(c);
            vec4 petalLine = vec4(c, petalAlpha);
            petalColor = mix(petalColor, petalLine, petalAlpha);

            folowerColor = petalColor;
        }  
        pos += vec2(petalDis, 0); //translate back to the origin    
    return folowerColor;
}





void main() {
    vec2 st = gl_FragCoord.xy/u_resolution.xy;
    vec4 bgColor = vec4(1.);
    //tree
    vec4 treeColor = fractalTree(st, 0.2, PI*((-0.72)), vec2(1., 1.0), 0.024, vec3(0.0), 0.0);
    
    //flower
    vec4 finalColor = mix(bgColor, treeColor, treeColor.a);
    vec4 flowerColor = vec4(0.);
    
    for(int i = 8; i< 81; i++){
        if(mod(float(i),3.)!=0.){
        vec2 branchPos = stack[i].startPos;
        vec2 pos = st - branchPos-vec2((random(branchPos.x)-0.5), (random(branchPos.y)-0.5))*0.1;
        float flowerHue = remap(random(float(i*30)), 0., 1.0, 0.9, 1.);
        float flowerSize = random(float(i))*0.03+0.04;
        flowerColor = fullFlower(st, pos, flowerHue, flowerSize);
        finalColor = mix(finalColor, flowerColor, flowerColor.a);    
        }
       
    }
    
    gl_FragColor = finalColor;
}


