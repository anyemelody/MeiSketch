const canvasSketch = require("canvas-sketch");
const load = require("load-asset");
const p5 = require("p5");
const dat = require("dat.gui");
const createTree = require("./tree");

new p5();
let flowerShader, wallShader, wallCanvas, wallImage, flowerCanvas, windowCanvas, windowShader, snowShader, snowCanvas, tree;

function drawFlowerCanvas() {
  //p5 unbinds sampler uniforms after every draw, the image itself stays uploaded
  flowerShader.setUniform('u_wall', wallImage);
  flowerShader.setUniform('u_segA', tree.segA);
  flowerShader.setUniform('u_segB', tree.segB);
  flowerShader.setUniform('u_rest', tree.rest);
  flowerShader.setUniform('u_fallA', tree.fallA);
  flowerShader.setUniform('u_fallB', tree.fallB);
  flowerShader.setUniform('u_fallC', tree.fallC);
  flowerCanvas.background(0, 0, 0, 0);
  flowerCanvas.quad(-512, -512, 512, -512, 512, 512, -512, 512);
}

function drawWall() {
  wallCanvas.background(0, 0, 0, 0);
  wallCanvas.quad(-512, -512, 512, -512, 512, 512, -512, 512);
  //an image is uploaded once, a graphics would be uploaded every frame
  wallImage = wallCanvas.get();
}

function updateWall() {
  let color = guiProperty.bgColor.map(c => c / 255.);
  color.push(1.);
  wallShader.setUniform('u_color', color);
  wallShader.setUniform('u_age', guiProperty.WallAge);
  drawWall();
  drawFlowerCanvas();
}

//setup gui
const gui = new dat.GUI({ name: 'My GUI' });
let guiProperty = { bgColor: [121, 23, 27.5], WallAge: 0.6, PetalSheer: 0.5, WindowShape: 8, WindowColor: [46, 77, 61] };

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
gui.addColor(guiProperty, 'bgColor', [121, 23, 27.5]).onChange(updateWall);
gui.add(guiProperty, 'WallAge', 0, 1, 0.01).onChange(updateWall);
gui.add(guiProperty, 'PetalSheer', 0, 1, 0.01).onChange(() => {
  flowerShader.setUniform('u_sheer', guiProperty.PetalSheer);
  drawFlowerCanvas();
});



//open the page with ?record to get a button that saves a video of the canvas
function addRecordButton(canvas) {
  const seconds = 25;
  const button = createButton(`Record ${seconds}s`);
  button.position(10, 110);
  button.mousePressed(() => {
    const mimeType = ['video/webm;codecs=vp9', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(canvas.captureStream(30), { mimeType, videoBitsPerSecond: 12000000 });
    const chunks = [];
    recorder.ondataavailable = event => chunks.push(event.data);
    recorder.onstop = () => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob(chunks, { type: 'video/webm' }));
      link.download = 'mei-preview.webm';
      link.click();
      button.html(`Saved. Record ${seconds}s again`);
      button.removeAttribute('disabled');
    };
    recorder.start();
    button.attribute('disabled', '');
    let left = seconds;
    button.html(`Recording... ${left}s`);
    const timer = setInterval(() => {
      left--;
      button.html(`Recording... ${left}s`);
      if (left <= 0) {
        clearInterval(timer);
        recorder.stop();
      }
    }, 1000);
  });
}

window.preload = () => {
  flowerShader = loadShader('./flower.vert', './flower.frag');
  windowShader = loadShader('./flower.vert', './windowPattern.frag');
  wallShader = loadShader('./flower.vert', './wall.frag');
  snowShader = loadShader('./snow.vert', './snow.frag');
};

const sketch = ({ canvas }) => {
  let link = createA("https://github.com/anyemelody/MeiSketch", "Check out the source on Github", "_blank");
  link.position(10, 70);
  if (new URLSearchParams(location.search).has('record')) addRecordButton(canvas);
  flowerCanvas = createGraphics(1024, 1024, WEBGL);
  flowerCanvas.shader(flowerShader);
  flowerCanvas.blendMode(BLEND);
  flowerShader.setUniform('u_resolution', [width, height]);
  wallCanvas = createGraphics(1024, 1024, WEBGL);
  wallCanvas.shader(wallShader);
  wallCanvas.blendMode(BLEND);
  wallShader.setUniform('u_resolution', [width, height]);
  wallShader.setUniform('u_color', [0.475, 0.090, 0.108, 1.]);
  wallShader.setUniform('u_age', guiProperty.WallAge);
  drawWall();
  flowerShader.setUniform('u_sheer', guiProperty.PetalSheer);
  tree = createTree(random(1));
  //an opening gust, so the tree is already moving when it appears
  tree.breeze(random([-1, 1]), random(-0.4, 0.1));
  drawFlowerCanvas();

  //a click taps the nearby branches downward, they sway back on their own
  canvas.addEventListener('pointerdown', (event) => {
    const bounds = canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = 1 - (event.clientY - bounds.top) / bounds.height;
    tree.push(x, y, random(-0.35, 0.35), -1);
  });

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


  return ({ context, width, height, deltaTime }) => {
    clear();
    /*Update tree sway, the flower shader only reruns while something moves*/
    if (tree.step(Math.min(deltaTime || 1 / 60, 0.05))) {
      drawFlowerCanvas();
    }
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
