let Papa = require('papaparse');
import {Strategy} from './Strategy'

const importStrategy = new Strategy();

console.log(`
    // 1. choose the strategy panel
    let strat1 = new Strategy(0);

    // 2. init with options
    strat1.init();

    // 3. start !
    strat1.start();
`);
