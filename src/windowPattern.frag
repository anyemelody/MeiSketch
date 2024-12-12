#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform int u_shape;
uniform vec4 u_color;

vec2 random2( vec2 p ) {
    return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);
}


float sdCircle( vec2 st, float r )
{
    return length(st) - r;
}

float sdBox( in vec2 st, in vec2 b )
{
    vec2 d = abs(st)-b;
    return length(max(d,0.0)) + min(max(d.x,d.y),0.0);
}


float sdStar( in vec2 st, in float r, in int n, in float m)
{
    // next 4 lines can be precomputed for a given shape
    float an = 3.141593/float(n);
    float en = 3.141593/m;  // m is between 2 and n
    vec2  acs = vec2(cos(an),sin(an));
    vec2  ecs = vec2(cos(en),sin(en)); // ecs=vec2(0,1) for regular polygon

    float bn = mod(atan(st.x,st.y),2.0*an) - an;
    st = length(st)*vec2(cos(bn),abs(sin(bn)));
    st -= r*acs;
    st += ecs*clamp( -dot(st,ecs), 0.0, r*acs.y/ecs.y);
    return length(st)*sign(st.x);
}

// voronoi function Created by inigo quilez - iq/2013
vec3 voronoi( in vec2 x ) {
    vec2 n = floor(x);
    vec2 f = fract(x);

    // first pass: regular voronoi
    vec2 mg, mr;
    float md = 8.0;
    for (int j= -1; j <= 1; j++) {
        for (int i= -1; i <= 1; i++) {
            vec2 g = vec2(float(i),float(j));
            vec2 o = random2( n + g );
            o = 0.5 + 0.5*sin(u_time + 6.2831*o );//u_time

            vec2 r = g + o - f;
            float d = dot(r,r);

            if( d<md ) {
                md = d;
                mr = r;
                mg = g;
            }
        }
    }

    // second pass: distance to borders
    md = 8.0;
    for (int j= -2; j <= 2; j++) {
        for (int i= -2; i <= 2; i++) {
            vec2 g = mg + vec2(float(i),float(j));
            vec2 o = random2( n + g );
            o = 0.5 + 0.5*sin(u_time + 6.2831*o );//u_time

            vec2 r = g + o - f;

            if ( dot(mr-r,mr-r)>0.00001 ) {
                md = min(md, dot( 0.5*(mr+r), normalize(r-mr) ));
            }
        }
    }
    return vec3(md, mr);
}

void main() {
    vec2 st = gl_FragCoord.xy/u_resolution.xy;
    st.x *= u_resolution.x/u_resolution.y;
    float innerShape = sdStar(st-vec2(0.5), 0.46, u_shape, 2.0);
    float border = step(-0.016,innerShape)*step(innerShape, 0.0);
    
    float box = sdBox(st-vec2(0.5), vec2(0.5));
    float boxBorder = step(-0.02, box)*step(box, 0.0);
    border += boxBorder;
    
    float shapeMask = step(0.,innerShape);
    float pattern = 0.;

     // voronoi pattern
    st *= 16.; // Scale
    vec3 c = voronoi(st);
    pattern = mix( 1., pattern, smoothstep( 0.0, 0.05, c.x ) );
    pattern *= shapeMask;
    pattern += border;
    pattern = step(0.1, pattern);

    vec4 color = mix(vec4(0.), u_color, pattern);
    gl_FragColor = vec4(color);
}
