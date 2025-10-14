const { translate } = require('./lib/translate');

async function test() {
    try {
        const testContent = `## 1.2.0 (2025-10-14)

### ✨ Features

* add reactions functionality @oljc in [#3](https://github.com/oljc/release/pull/3) ([693d7dd](https://github.com/oljc/release/commit/693d7dd5bf28fe88e2e1f273d5333feaff1569d9))

* rename prerelease input to channel and update related documentation @oljc ([0f8832c](https://github.com/oljc/release/commit/0f8832c5dec42ad9d13286b11b323e83f9de634d))

### 🔧 Others

* **ci:** add major version tag update step @oljc ([3604f35](https://github.com/oljc/release/commit/3604f35e53b7209589ade20b704648b2f1530099))`;

        console.log('开始翻译');

        const result = await translate(testContent, '中文');
        
        console.log(result);
        
    } catch (error) {
        console.error('测试失败：', error);
    }
}

test();