// Aged, ink-washed red wall. Rendered once into a texture for flower.frag.
#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform vec4 u_color;
uniform float u_age;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3. - 2. * f);
    return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x),
               mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
}

float fbm(vec2 p) {
    float v = 0.;
    float a = 0.5;
    for(int i = 0; i < 5; i++) {
        v += a * noise(p);
        p = p * 2.03 + vec2(17.3, 9.1);
        a *= 0.5;
    }
    return v;
}

// few octaves keep the outline of a wash round instead of frayed
float softFbm(vec2 p) {
    float v = 0.;
    float a = 0.5;
    for(int i = 0; i < 3; i++) {
        v += a * noise(p);
        p = p * 2.03 + vec2(17.3, 9.1);
        a *= 0.5;
    }
    return v / 0.875;
}

// the wash, domain warped so the edges bleed like pigment
float wash(vec2 p) {
    vec2 q = vec2(softFbm(p), softFbm(p + vec2(5.2, 1.3)));
    return softFbm(p + 1.4 * q);
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    vec3 base = u_color.rgb;
    vec3 ink = vec3(0.10, 0.04, 0.05);
    vec3 col = base;

    // 1. ink wash
    float w = wash(st * 2.2);
    float tone = smoothstep(0.25, 0.75, w) - 0.5;
    float dark = smoothstep(0.5, 0.78, w);
    col *= 1. + 0.28 * tone * u_age;
    col = mix(col, ink, 0.22 * dark * u_age);

    // 2. tide lines, pigment pooling at the edge of the wash
    float tide = 0.;
    tide += 1. - smoothstep(0., 0.06, abs(w - 0.46));
    tide += 0.7 * (1. - smoothstep(0., 0.05, abs(w - 0.60)));
    col *= 1. - 0.10 * tide * u_age;

    // 3. rain streaks from the top
    float streak = noise(vec2(st.x * 70., st.y * 1.6 + noise(vec2(st.x * 6., 3.)) * 2.));
    streak = smoothstep(0.4, 0.8, streak) * (0.5 + 0.5 * noise(vec2(st.x * 25., st.y * 1.5)));
    float rain = streak * smoothstep(0.45, 1., st.y);
    col = mix(col, ink, 0.24 * rain * u_age);

    // 4. flaked plaster, more toward the bottom
    float f = fbm(st * 6. + vec2(40., 7.)) + 0.15 * (fbm(st * 24.) - 0.5);
    float thr = 0.70 - 0.05 * (1. - st.y);
    float patch = smoothstep(thr, thr + 0.05, f);
    float rim = smoothstep(thr - 0.05, thr, f) * (1. - patch);
    vec3 plaster = mix(col, vec3(dot(col, vec3(0.33))) + 0.04, 0.25) * 1.06;
    col = mix(col, plaster, 0.7 * patch * u_age);
    col *= 1. - 0.15 * rim * u_age;

    // 5. grain
    col *= 1. + 0.04 * (hash(gl_FragCoord.xy) - 0.5) * u_age;

    gl_FragColor = vec4(clamp(col, 0., 1.), 1.);
}
