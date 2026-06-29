(function () {
  function initFooterMG() {
    var canvas = document.getElementById('footer-mg');
    if (!canvas || canvas.dataset.initialized) return;
    canvas.dataset.initialized = "true";

    var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return;

    var VS = 'attribute vec2 a_pos; void main(){ gl_Position=vec4(a_pos,0,1); }';
    var FS = [
      'precision highp float;',
      'uniform float u_time; uniform vec2 u_res;',
      'vec2 h2(vec2 p){p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));return fract(sin(p)*43758.5453);}',
      'float sn(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);float a=dot(h2(i)-.5,f),b=dot(h2(i+vec2(1,0))-.5,f-vec2(1,0)),c=dot(h2(i+vec2(0,1))-.5,f-vec2(0,1)),d=dot(h2(i+vec2(1))-.5,f-vec2(1));return .5+dot(vec2(mix(a,b,u.x),mix(c,d,u.x)),mix(vec2(1,0),vec2(0,1),u.y));}',
      'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*sn(p);p=p*2.+vec2(5.2,1.3);a*=.5;}return v;}',
      'void main(){',
      '  vec2 uv=gl_FragCoord.xy/u_res; uv.y=1.-uv.y;',
      '  float t=u_time*0.18;',
      '  vec2 w1=vec2(fbm(uv*1.8+vec2(t*.9,0.)),fbm(uv*1.8+vec2(0.,t*.7)+3.7));',
      '  vec2 w2=vec2(fbm(uv*2.4+2.2*w1+vec2(t*.6,.3)),fbm(uv*2.4+2.2*w1+vec2(.3,t*.5)+9.2));',
      '  vec2 q=uv+0.85*w2;',
      '  vec2 cen=q-.5; float ang=length(cen)*4.*.06+t*.4; float cs=cos(ang),sn2=sin(ang);',
      '  vec2 sw=vec2(cs*cen.x-sn2*cen.y,sn2*cen.x+cs*cen.y)+.5;',
      '  float n1=smoothstep(.30,.72,fbm(sw*2.1+t*.5));',
      '  float n2=smoothstep(.28,.70,fbm(sw*1.6-t*.4+2.3));',
      '  float n3=smoothstep(.32,.68,fbm(sw*3.+t*.3+5.9));',
      '  vec3 col=mix(vec3(.059,.071,.094),vec3(.290,.357,.659),n1);',
      '  col=mix(col,vec3(.498,.651,.902),n2*.75);',
      '  col=mix(col,vec3(.663,.800,.949),n3*.30);',
      '  float fade=smoothstep(.42,1.,uv.y);',
      '  col=mix(col,vec3(.902,.922,.965),fade*fade*1.05);',
      '  float topDark=smoothstep(.55,0.,uv.y);',
      '  col=mix(col,vec3(.059,.071,.094),topDark);',
      '  float grain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);',
      '  col+=(grain-.5)*.018;',
      '  gl_FragColor=vec4(clamp(col,0.,1.),1.);',
      '}'
    ].join('\n');

    function mk(type, source) {
      var shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    }

    var prog = gl.createProgram();
    gl.attachShader(prog, mk(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);

    var ap = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(ap);
    gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 0, 0);

    var uT = gl.getUniformLocation(prog, 'u_time');
    var uR = gl.getUniformLocation(prog, 'u_res');

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = canvas.clientWidth || 1;
      var h = canvas.clientHeight || 1;
      var pw = Math.round(w * dpr);
      var ph = Math.round(h * dpr);

      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
        gl.viewport(0, 0, pw, ph);
      }

      gl.uniform2f(uR, pw, ph);
    }

    if (window.ResizeObserver) {
      new ResizeObserver(resize).observe(canvas.parentElement || canvas);
    }

    resize();
    var t0 = performance.now();

    (function frame() {
      requestAnimationFrame(frame);
      resize();
      gl.uniform1f(uT, (performance.now() - t0) / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    })();
  }

  document.addEventListener("acceptorIQ:includes-loaded", initFooterMG);
  document.addEventListener("DOMContentLoaded", initFooterMG);
})();
