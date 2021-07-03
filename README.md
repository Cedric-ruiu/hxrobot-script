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

| indicator | support | nb parameters | nb cursors | nb tests | nb days |
|-----------|---------|---------------|------------|----------|---------|
| Random | :heavy_check_mark: | 3 | 1202 | 10201000 | 1416 Days |
| Payout | :heavy_check_mark: | 5 | 141 | 85600 | 12 Days |
| SAR | :heavy_check_mark: | 7 | 338 | 705672000 | 98010 Days |
| Orderflow | :heavy_check_mark: | 8 | :grey_question: | :grey_question: | :grey_question: |
| Delta div | :heavy_check_mark: | 7 | :grey_question: | :grey_question: | :grey_question: |
| Streak | :x: | 6 | :grey_question: | :grey_question: | :grey_question: |
| Stoch | :heavy_check_mark: | 6 | 70 | 96000 | 13.3 Days |
| Bollinger | :heavy_check_mark: | 5 | 90 | 36000 | 5 Days |
| MACD | :heavy_check_mark: | 5 | 100 | 43200 | 6 Days |
| RSI | :heavy_check_mark: | 6 | 1041 | 288708000 | 40098 Days |
| Orderbook | :x: | 7 | :grey_question: | :grey_question: | :grey_question: |
| Autocorr | :heavy_check_mark: | 10 | 1088 | 48192192000 | 6693360 Days |

## Tested

|               | Random | Payout | SAR | Orderflow | Delta | Streak | Stoch | Bollinger | MACD | RSI | Orderbook | Autocorr |
|---------------|:------:|:------:|:---:|:---------:|:-----:|:------:|:-----:|:---------:|:----:|:---:|:---------:|:--------:|
| **eth 15min** |        |    x   |     |           |       |        |  x    |           |  x   |     |           |          |
|               |        |        |     |           |       |        |       |           |      |     |           |          |