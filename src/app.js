import {Strategy} from './Strategy'

const importStrategy = new Strategy();

console.groupCollapsed(`HXROBOT-SCRIPT v${Strategy.version}`);
console.log('%c// 1. choose the strategy panel', 'color:#ccc');
console.log('let strat1 = new Strategy(0);');
console.log('%c// 2. init with options', 'color:#ccc');
console.log('strat1.init();');
console.log('%c// 3. start !', 'color:#ccc');
console.log('strat1.start();');
console.groupEnd();
