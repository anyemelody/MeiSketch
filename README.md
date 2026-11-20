# Mei Flower Sketch 
![](https://github.com/anyemelody/MeiSketch/blob/main/images/preview.gif)

Plum blossoms, often regarded as the Flower Deity of January in Transiditional Chinese Culture, symbolize the beginning of a new year. Blooming alone in the heart of winter, they represent the qualities of resilience and elegance. And the qualities represented by the flower deity symbolizes the characteristics possessed by those born in this month.

https://anyemelody.github.io/MeiSketch/


## Interaction
The tree reacts to clicks on the canvas:
1. Click a branch and the branches around the click are pushed down, then sway back slowly. Thick branches are stiff and slow, twigs are loose and a little quicker, and the flowers swing along with the branch they sit on.
2. Click the same spot several times in a row and the flowers there start to lose petals. How many petals fall is random, and the further a flower is from the click, the fewer it loses. The petals tumble and drift on their way down.
3. Every few seconds a new flower starts at a random spot on the branches. Its petals grow slowly out of the centre until it is in full bloom. A flower that has lost all of its petals withers, which makes room for a new one.

The tree appears with about half of its flowers open, one to three young ones, and a gust of wind so it is already moving.

The GUI on the page changes the window shape and colour, the wall colour, how aged the wall looks (`WallAge`) and how sheer the petals are (`PetalSheer`). Open the page with `?record` at the end of the address to get a button that saves a 25 second video of the canvas.


## How to use
The effect is written in GLSL and [canvas-sketch](https://github.com/mattdesl/canvas-sketch) for printing use cases. All original files are in `src` folder. 
Download the `src` folder for local use,  
 
command to preview the effect:

`canvas-sketch index.js --open`

to print the effect: cmd+s


## Inspiration
The visual inspiration of this project is from the snow scene of the Forbidden City. The red walls and green windows are the most iconic features of the Forbidden City, as well as the most representative features of Chinese traditional architecture.
![](https://github.com/anyemelody/MeiSketch/blob/main/images/reference.png)


## Code Structure
The code is written in GLSL and JavaScript and consists of five parts: 
1. "flower.frag" which defines the visual effect of the flower and the branches.
2. "tree.js" which generates the branch skeleton and animates it: the sway, the falling petals and the blooming.
3. "wall.frag" which defines the aged red wall behind the tree.
4. "windowPattern.frag" which defines the visual effect of the window frame pattern.
5. "snow.frag" which defines the visual effect of the snowing scene. And I referred the snowing effect from: https://www.shadertoy.com/view/Mdt3Df


### "flower.frag"
For the branch design, I used the fractal tree algorithm and applied random to the branch rotation angle. The length and width of the branches are using simple noise function and set connections between the preview branches properties to make the branches look more natural.
![](https://github.com/anyemelody/MeiSketch/blob/main/images/fractal%20branch.png)
The positions of the branches are calculated in "tree.js" and sent to the shader, the shader draws each branch and gives it its width.

I have also added noise pattern to the branches to create some visual effects.

            float pattern = smoothstep(0., 0.1, fract((1. - noise(restSt * 30.)) * 5.));

The noise of a branch is read at the place where the branch rests, not where it currently is. This way the width and the pattern move together with the branch when it sways.

For the flower design, I mainly used the Rose curve function with perlin noise to generate the natural petal shape. Applied simple noise to the petal color to create the light and dark contrast and make the flower look more realistic.

            vec2 warped = pos / grown - vec2(bulge); //make the petal shape has more dynamic shape
            float dis = length(warped);
            float ray = atan(warped.y, warped.x);
            float t = atan(sin(ray), slim * cos(ray)); //rose curve parameter of the rim on this ray
            float r = warped.x > 0. ? petalRadius * cos(t) * length(vec2(cos(t), slim * sin(t))) : 0.;
            //use point on petal to do color manipulation
            float saturate = clamp(remap(dis, 0.0, r * 0.88, baseSaturate, tipSaturate) - petalNoise * 0.3, -0.08, 1.);
            float fold = petalNoise * 0.2 + 0.9;
            float brightness = petalNoise * light + lightBase + 0.7 * max(1. - fold, 0.);
            vec3 c = hsv2rgb(vec3(hue, saturate, brightness));
            c = mix(c, vec3(1.), 0.45 * smoothstep(0.1, 0.6, petalNoise));

Along each ray from the base of a petal, `r` is how far the rose curve reaches, so the colour can follow the position on the petal: saturated at the base, white at the rim. `bulge` is the perlin noise of the petal, it bends the outline, and the same noise brightens the petal and adds a white glint where it bulges, which gives the gloss.

A young petal is the full petal scaled down around its base (`pos / grown`), so it stays attached where it joins the centre while it grows.

An earlier version built each petal from 32 line segments. It gives a sharper white edge inside the petal and a more velvet look, with fine streaks along the petal. That version is kept on the `petal-line-fan` branch.

### "tree.js"
The branch skeleton is built with the same fractal tree rule as in the sketch above. Each branch is a damped spring around its joint: a click gives the nearby branches an impulse, a branch carries all of its child branches with it, and each child lags a little behind its parent.

Each flower remembers how much it was shaken for about two seconds, so only quick clicks in the same place add up. Once that passes a threshold, each petal has a chance to come loose, and the chance drops with the distance to the click. A falling petal is still drawn by the shader as the same petal of its flower, only moved and rotated, so it keeps its shape and gloss.

All the numbers for tuning the motion are at the top of the file, for example `PUSH_STRENGTH`, `SHED_THRESHOLD` and `BLOOM_SECONDS`.

### "wall.frag"
The wall is drawn once and used as the background of the flower shader. It adds soft ink washes, rain streaks from the top, a few flaked patches and a fine grain to the wall colour.

### "windowPattern.frag"
Got inspiration from the window pattern of the Forbidden City. I generated the window pattern by using the Voronoi pattern and combined with the sdf shape to create the window frame. Feel free to change the window pattern by tweaking the GUI on the preview page.
