import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setCodec('h264');
Config.setCrf(20);
Config.setX264Preset('veryfast');
// WebGL para las escenas en 3D (three.js) en Studio y en los comandos de la CLI
Config.setChromiumOpenGlRenderer('angle');
