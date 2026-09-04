// Every scene registers its renderer here; the element is defined last so registration always wins the race.
import { defineLoopScene } from './_shared/loop-scene.js';
import './giving-up-control/render.js';
defineLoopScene();
