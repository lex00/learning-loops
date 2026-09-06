// Every scene registers its renderer here; the element is defined last so registration always wins the race.
import { defineLoopScene } from './_shared/loop-scene.js';
import './waiting-on-io/render.js';
import './truly-parallel/render.js';
import './yielding/render.js';
defineLoopScene();
