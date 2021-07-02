# hxrobot-script

copy/paste `dist/hxrobot-script.js` into Chrome dev console

and choose a strategy panel, several way to do this :

```javascript
// provide the number
let strategy = new Strategy(0);

// provide element
let strategy = new Strategy(document.querySelector('.strategy'));

// provide added ID name
let strategy = new Strategy('my-id-strategy');
```

## init

```javascript
// basic init
strategy.init({});

// or full options
strategy.init({
    0: {ignore: true}, // 'ignore' to not touch this parameter, default to `false`
    1: {min: 4, max: 6}, // default to `'auto'`
    2: {increment: 2} // default to `'auto'`
    3: {min: false, max: false, increment: false}, // disable `'auto'` mode
    debug: true,
    jumpBacktest: 2135,
});
```

#### global options

- `debug` - boolean - default: false
- `jumpBacktest` - integer - default: 0

#### parameter options

- `increment` - 'auto' | float | false - default: 'auto'
- `min` - 'auto' | float | false - default: 'auto'
- `max` - 'auto' | float | false - default: 'auto'
- `ignore` - boolean - default: false

## Start backtests

```javascript
strategy.start();
```

## Supported indicators

| indicator | support | nb parameters |
|-----------|---------|---------------|
| Random | :heavy_check_mark: | 3 |
| Payout | :heavy_check_mark: | 5 |
| SAR | :heavy_check_mark: | 7 |
| Orderflow | :heavy_check_mark: | 8 |
| Delta div | :heavy_check_mark: | 7 |
| Streak | :x: | 6 |
| Stoch | :heavy_check_mark: | 6 |
| Bollinger | :heavy_check_mark: | 5 |
| MACD | :heavy_check_mark: |  |
| RSI | :heavy_check_mark: | 6 |
| Orderbook | :x: | 7 |
| Autocorr | :heavy_check_mark: | 10 |
