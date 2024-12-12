const canvasSketch = require("canvas-sketch");
const load = require("load-asset");
const p5 = require("p5");
const dat = require("dat.gui");

new p5();
let flowerShader, flowerCanvas, windowCanvas, windowShader, snowShader, snowCanvas;

//setup gui
const gui = new dat.GUI({ name: 'My GUI' });
let guiProperty = { bgColor: [121, 23, 27.5], WindowShape: 8, WindowColor: [46, 77, 61] };

const settings = {
  dimensions: [1024, 1024],
  p5: true,
  animate: true,
  contest: "webgl",
  attributes: {
    antialias: true,
  },
};


gui.add(guiProperty, 'WindowShape', 4, 24, 1).onChange(() => {
  windowShader.setUniform('u_time', random(1000));
  windowShader.setUniform('u_shape', guiProperty.WindowShape);
  windowCanvas.background(0, 0, 0, 0);
  windowCanvas.quad(-512, -512, 512, -512, 512, 512, -512, 512);
});
gui.addColor(guiProperty, 'WindowColor', [46, 77, 61]).onChange(() => {
  let color = guiProperty.WindowColor.map(c => c / 255.);
  color.push(1.);
  windowShader.setUniform('u_color', color);
  windowCanvas.background(0, 0, 0, 0);
  windowCanvas.quad(-512, -512, 512, -512, 512, 512, -512, 512);
});
gui.addColor(guiProperty, 'bgColor', [121, 23, 27.5]).onChange(() => {
  let color = guiProperty.bgColor.map(c => c / 255.);
  color.push(1.);
  flowerShader.setUniform('u_bgColor', color);
  flowerCanvas.background(0, 0, 0, 0);
  flowerCanvas.quad(-512, -512, 512, -512, 512, 512, -512, 512);
});



window.preload = () => {
  flowerShader = loadShader('./flower.vert', './flower.frag');
  windowShader = loadShader('./flower.vert', './windowPattern.frag');
  snowShader = loadShader('./snow.vert', './snow.frag');
};

const sketch = () => {
  let link = createA("https://github.com/anyemelody/MeiSketch", "Check out the source on Github", "_blank");
  link.position(10, 70);
  flowerCanvas = createGraphics(1024, 1024, WEBGL);
  flowerCanvas.shader(flowerShader);
  flowerCanvas.blendMode(BLEND);
  flowerShader.setUniform('u_resolution', [width, height]);
  flowerShader.setUniform('u_angle', random(1));
  flowerShader.setUniform('u_bgColor', [0.475, 0.090, 0.108, 1.]);
  flowerCanvas.quad(-512, -512, 512, -512, 512, 512, -512, 512);

  windowCanvas = createGraphics(1024, 1024, WEBGL);
  windowCanvas.shader(windowShader);
  windowCanvas.blendMode(BLEND);
  windowShader.setUniform('u_resolution', [width, height]);
  windowShader.setUniform('u_time', 0.0);
  windowShader.setUniform('u_shape', 8);
  windowShader.setUniform('u_color', [46. / 255., 77. / 255., 61. / 255., 1.]);
  windowCanvas.quad(-512, -512, 512, -512, 512, 512, -512, 512);

  snowCanvas = createGraphics(1024, 1024, WEBGL);
  snowCanvas.shader(snowShader);
  snowCanvas.blendMode(BLEND);
  snowShader.setUniform('u_resolution', [width, height]);


  return ({ context, width, height }) => {
    clear();
    image(flowerCanvas, 0, 0);//redraw flower
    image(windowCanvas, 0, 0);//redraw window
    /*Update snow*/
    snowShader.setUniform('u_time', frameCount * 0.005);
    snowCanvas.background(0, 0, 0, 0);
    snowCanvas.quad(-512, -512, 512, -512, 512, 512, -512, 512);
    image(snowCanvas, 0, 0);
  };
};

canvasSketch(sketch, settings);
