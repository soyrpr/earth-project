export default `
uniform sampler2D dayTexture;
uniform sampler2D nightTexture;
uniform vec3 lightDirection;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    float dotProduct = dot(normalize(vNormal), normalize(lightDirection));
    float mixAmount = clamp(dotProduct * 2.0, 0.0, 1.0);

    vec4 dayColor = texture2D(dayTexture, vUv);
    vec4 nightColor = texture2D(nightTexture, vUv);

    gl_FragColor = mix(nightColor, dayColor, mixAmount);
  }
`;
