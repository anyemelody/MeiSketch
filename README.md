# Mei Flower Sketch 
![](https://github.com/anyemelody/MeiSketch/blob/main/images/preview.gif)

Plum blossoms, often regarded as the Flower Deity of January in Transiditional Chinese Culture, symbolize the beginning of a new year. Blooming alone in the heart of winter, they represent the qualities of resilience and elegance. And the qualities represented by the flower deity symbolizes the characteristics possessed by those born in this month.

https://anyemelody.github.io/MeiSketch/


## How to use
The effect is written in GLSL and [canvas-sketch](https://github.com/mattdesl/canvas-sketch) for printing use cases. All original files are in `src` folder. 
Download the `src` folder for local use,  
 
command to preview the effect:

`canvas-sketch index.js --open`

to print the effect: cmd+s


## Inspiration
The visual inspiration of this project is from the snow scene of the Forbidden City. The red walls and green windows are the most iconic features of the Forbidden City, as well as the most representative features of Chinese traditional architecture.
![](https://github.com/anyemelody/MeiSketch/blob/main/Images/reference.png)


## Code Structure
The code is written in GLSL and consists of three parts: 
1. "flower.frag" which defines the visual effect of the flower and the branches.
2. "windowPattern.frag" which defines the visual effect of the window frame pattern.
3. "snow.frag" which defines the visual effect of the snowing scene. And I referred the snowing effect from: https://www.shadertoy.com/view/Mdt3Df


### "flower.frag"
For the branch design, I used the fracal tree algorithm and applied random to the branch rotation angle. The length and width of the branches are using simple noise function and set connections between the preview branches properties to make the branches look more natural.
I have also added noise pattern to the branches to create some visual effects.

            alpha *= smoothstep(0., 0.1, fract((1. - noise(st * 30.)) * 5.));

For the flower design, I mainly used the Rose curve function with perlin noise to generate the natural petal shape. Applied simple noise to the petal color to create the light and dark contrast and make the flower look more realistic.

            vec2 endPoint = rosegraph(petalRadius, 1., j);
            float petalNoise = perlin(st * 40.);
            endPoint.y *= 0.7; //make the petal slim 
            endPoint += vec2(petalNoise * 0.01); //make the petal shape has more dynamic shape
            petalAlpha = segment(pos, centerPoint, endPoint, 0.005);
            //use point on petal to do color manipulation
            float dis = distance(pos, centerPoint);
            float r = distance(centerPoint, endPoint);
            petalAlpha *= petalNoise * 0.2 + 0.9;//alpha variation 
            float saturate = remap(dis, 0.0, r, 0.8, 0.2) - petalNoise * 0.3;
            float brightness = petalNoise * 0.5 + 0.7;
            vec3 c = vec3(hue, saturate, brightness);
            c = hsv2rgb(c);
            vec4 petalLine = vec4(c, petalAlpha);
            petalColor = mix(petalColor, petalLine, petalAlpha);

### "windowPattern.frag"
Got inspiration from the window pattern of the Forbidden City. I generated the window pattern by using the Voronoi pattern and combined with the sdf shape to create the window frame. Feel free to change the window pattern by tweaking the GUI on the preview page.
