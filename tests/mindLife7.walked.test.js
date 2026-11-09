// Dave alone for ten game days on island 7, the walked scenario (0.30.2 "Checks": one file per scenario, so the long runs spread over the workers). Configuration: helpers/lifeSeeds; checks: helpers/lifeSuite.
import { lifeSuite } from './helpers/lifeSuite.js';
import { LIFE } from './helpers/lifeSeeds.js';

lifeSuite(7, LIFE[7], 'walked');
