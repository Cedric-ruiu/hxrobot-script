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
    jumpTestAfterStart: 2135,
    jumpTestZeroTrade: true,
    jumpTestMinusEarning: true,
});
```

### global options

| name | type | default | description |
|------|------|---------|-------------|
| `jumpTestAfterStart` | integer | `0` | start backtests after a specific number of tests (useful if script has been stop and restart it) |
| `jumpTestZeroTrade` | boolean | `false` | only working if the last non-ignored parameter is a slider type. If a test provide a 0 trade, it jump all following cursor tests for the last parameter. (ex: useful for Orderflow) |
| `jumpTestMinusEarning` | boolean | `false` | only working if the last non-ignored parameter is a slider type. If a test have a smaller earning that the previous one, it jump the following test in the last parameter. |
| `debug` | boolean | `false` | only to help debugging |

```javascript
strategy.init({
    debug: true,
    jumpTestAfterStart: 2135,
    jumpTestZeroTrade: true,
    jumpTestMinusEarning: true,
});
```

### parameter options

| name | type/value | default | description |
|------|------|---------|-------------|
| `increment` | `'auto'` / float / `false` | `'auto'` | default value (`'auto'`) keep only 10 cursor for the parameter. Set `false` to keep all cursor, or set a custom value number to increment (ex: `2`, `0.8`, etc.) |
| `min` | `'auto'` / float / `false` | `'auto'` | default value (`'auto'`) remove the first cursor of the parameter. Set `false` to keep the extreme minimum value, or set a custom value for min (ex: `2`, `0.8`, etc.) |
| `max` | `'auto'` / float / `false` | `'auto'` | Same as min, but for the max value |
| `ignore` | boolean | `false` | ignore this parameter, backtest never touch this one |

```javascript
strategy.init({
    0: {ignore: true},
    1: {min: 4, max: 6},
    2: {increment: 2},
    3: {min: false, max: false, increment: false}, // disable `'auto'` mode
});
```

## Start backtests

PC must not be on standby, and the chrome tab must be active during all time for the backtest.

```javascript
strategy.start();
```

## Supported indicators

| indicator | support | nb parameters | nb cursors | nb tests | nb days |
|-----------|---------|---------------|------------|----------|---------|
| Random | :heavy_check_mark: | 3 | 1202 | 10201000 | 1416 Days |
| Payout | :heavy_check_mark: | 5 | 141 | 85600 | 12 Days |
| SAR | :heavy_check_mark: | 7 | 338 | 705672000 | 98010 Days |
| Orderflow | :heavy_check_mark: | 8 | 1044 | 6943132800 | 964324 Days |
| Delta div | :heavy_check_mark: | 7 | 150 | 3341760 | 464 Days |
| Streak | :x: | 6 | :grey_question: | :grey_question: | :grey_question: |
| Stoch | :heavy_check_mark: | 6 | 70 | 96000 | 13 Days |
| Bollinger | :heavy_check_mark: | 5 | 90 | 36000 | 5 Days |
| MACD | :heavy_check_mark: | 5 | 100 | 43200 | 6 Days |
| RSI | :heavy_check_mark: | 6 | 1041 | 288708000 | 40098 Days |
| Orderbook | :x: | 7 | :grey_question: | :grey_question: | :grey_question: |
| Autocorr | :heavy_check_mark: | 10 | 1088 | 48192192000 | 6693360 Days |

## Supported options

|               | slider | input + slider | switch | switch + slider | select |
|:--------------|:------:|:--------------:|:------:|:---------------:|:------:|
| ignore        |:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|:x:|:heavy_check_mark:|
| increment     |:heavy_check_mark:|:heavy_check_mark:|:x:|:x:|:x:|
| min           |:heavy_check_mark:|:heavy_check_mark:|:x:|:x:|:x:|
| max           |:heavy_check_mark:|:heavy_check_mark:|:x:|:x:|:x:|
| zeroJumpEnd   |:heavy_check_mark:|:heavy_check_mark:|:x:|:x:|:x:|
| minusJumpNext |:heavy_check_mark:|:heavy_check_mark:|:x:|:x:|:x:|

## Already tested

|               | Random | Payout | SAR | Orderflow | Delta | Streak | Stoch | Bollinger | MACD | RSI | Orderbook | Autocorr |
|---------------|:------:|:------:|:---:|:---------:|:-----:|:------:|:-----:|:---------:|:----:|:---:|:---------:|:--------:|
| **eth 15min** |        |    x   |     |     x     |   x   |        |  x    |     x     |  x   |  x  |     x     |          |
|               |        |        |     |           |       |        |       |           |      |     |           |          |

## Other

```javascript
// Test indicator with fully backtests
strategy.init({
    0: {min:false, max:false, increment:false},
    1: {min:false, max:false, increment:false},
    2: {min:false, max:false, increment:false},
    3: {min:false, max:false, increment:false},
    4: {min:false, max:false, increment:false},
    5: {min:false, max:false, increment:false},
    6: {min:false, max:false, increment:false},
    7: {min:false, max:false, increment:false},
    8: {min:false, max:false, increment:false},
    9: {min:false, max:false, increment:false},
})
```
