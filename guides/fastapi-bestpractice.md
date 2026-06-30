# FastAPI 最佳实践指南（完备版）

> **版本基线**：FastAPI 0.138.2（2026.06，[PyPI](https://pypi.org/project/fastapi/) · [官方 release notes](https://fastapi.tiangolo.com/release-notes/)）
> **配套栈**：Pydantic 2.13 · SQLAlchemy 2.0.51 · asyncpg 0.31 · PyJWT 2.13 · argon2-cffi 25.1 · httpx 0.28 · uvicorn 0.49（版本均经 PyPI JSON API 核实，2026.06）
> **文档类型**：领域指南（domain-guide）→ 橙皮书风格 + 教程模式
> **深度层**：D3 原理 ✅ · D4 演变 ✅ · D5 心智模型 ✅ · D6 争议 ⭕(开) · D7 方向 ✅
> **量化锚点**：高并发下吞吐量约为 Django 的 5-10 倍（[2026 对比基准](https://python.plainenglish.io/django-vs-fastapi-in-2026-which-framework-should-you-choose-30ce2e1b6e32)，Plain English，统计口径：RPS 对比）
> **置信度图例**：★★★ 官方文档 + 社区共识 + 版本佐证 / ★★ 主流但未官方或单一可信源 / ★ 个人经验、小众做法或未量化

---

## 一句话核心

> **FastAPI 不是"更快的 Flask"，是会自动写文档、自动校验数据的 Python 类型系统。**

这句话决定你怎么用它。把它当"异步 Flask"，你会写出"用 FastAPI 语法写的 Flask 代码"——能跑，但浪费了它 90% 的能力。把它当"类型注解驱动的 API 生成器"，你才会把精力花在对的地方：**定义数据形状**，让框架替你干验证、文档、解析、错误处理的脏活。

---

# 第一部分：理解 FastAPI

## §01 为什么是 FastAPI

### 它不是"更快的 Flask"

很多人把 FastAPI 理解成"异步版 Flask"或"性能更好的 Django"。这两个理解都会让你用得很别扭，写出来的是"用 FastAPI 语法写的 Flask 代码"。

Flask 诞生于前后端还没分离的年代，生来是为了在后端渲染 HTML。Django 更早，带着一整套"batteries-included"（开箱即用）的行政后台、ORM、认证系统。它们都是好框架，但在 2018 年之后的 API 时代，开发者要反复用 Flask + 一堆插件拼凑现代 JSON API，或者忍受 Django 的同步模型在高并发下喘气。

FastAPI 的创建者 Sebastián Ramírez（tiangolo）受不了这种拼凑。他的原话：FastAPI 的核心是"把框架建立在标准类型注解、Pydantic 数据模型、自动 OpenAPI 生成之上"（[Evrone 访谈](https://evrone.com/blog/sebastian-ramirez-interview)）。它做的事其实只有一件——**你声明 `age: int`，它同时给你参数验证、文档生成、编辑器补全**。一个注解，三个收益。

打个比方：Flask 给你一套空房间自己装修；FastAPI 是你写一行类型注解，它就把装修、验收报告、使用说明书全给你生成了。

### 它跟 Django REST 到底差多少

这是 2026 年 Python 后端圈子最热的话题。差异不在"能不能做 API"，而在**性能模型和类型哲学**。

Plain English 2026 的对比基准显示：**高并发场景下，FastAPI 每秒处理的请求数是 Django 的 5-10 倍**（[2026 对比](https://python.plainenglish.io/django-vs-fastapi-in-2026-which-framework-should-you-choose-30ce2e1b6e32)）。这不是 FastAPI 更聪明，是它从第一天就建立在 ASGI 异步事件循环上，而 Django 的异步是后来"焊"上去的。

但性能不是全部。Loopwerk 的文章直接叫"为什么我仍然选 Django 而不是 Flask 或 FastAPI"（[Loopwerk](https://www.loopwerk.io/articles/2024/django-vs-flask-vs-fastapi/)）——Django 的 ORM + 迁移 + 行政后台这套组合拳，FastAPI 给不了。一个做过迁移的工程师说："Django ORM 是特性，不是局限"（[Level Up Coding 迁移实录](https://levelup.gitconnected.com/fastapi-vs-django-in-2026-i-moved-3-production-services-heres-what-happened-1adef750c5de)）。

> **核心建议**：别因为"FastAPI 性能好"就无脑选它。先问自己：你做的是纯 API 服务（尤其高并发/ML 模型服务），还是需要行政后台、复杂权限、完整 Web 功能的全栈应用？前者 FastAPI 完胜；后者 Django 的"batteries-included"可能省你几周。

### 这些数字意味着什么

FastAPI 在 GitHub 上的 star 数早已超过 Flask 和 Django（[JetBrains 对比](https://blog.jetbrains.com/pycharm/2025/02/django-flask-fastapi/)），成为 Python 后端框架里增长最快的。但比 star 更有说服力的是它的采用场景——它几乎是**机器学习模型服务的事实标准**。Pydantic 定义输入输出 + async 高并发 + 自动文档，正好是 ML API 的三个刚需。

> **核心建议**：把 FastAPI 当成"类型注解驱动的 API 生成器"，不是"异步 Flask"。这个心智转换，决定了你写的是 FastAPI 代码，还是"用 FastAPI 语法写的 Flask 代码"。

---

## §02 三层心智模型：你的时间该花在哪

讲了这么多，建立一个全局视角。FastAPI 的所有特性和坑，可以归入三层。理解了它，你就知道每个问题出在哪一层，也知道时间该花在哪。

```
代码层（Pydantic 模型 + 类型注解）
   ↓ 你定义数据形状，FastAPI 读这个形状干活
框架层（Starlette 事件循环 + 依赖注入）
   ↓ FastAPI 把你的代码塞进异步循环里跑
运维层（Uvicorn worker + 容器 + 反向代理）
   ↓ 生产环境怎么把请求送到框架
```

- **代码层**出问题 → 数据验证失败、文档错乱（症状：422 错误、Swagger 里字段不对）
- **框架层**出问题 → 阻塞事件循环、资源泄漏（症状：吞吐量塌方、内存涨）
- **运维层**出问题 → 单核跑不满、部署后各种 undefined（症状：本地能跑上线崩）

> **核心建议（D5 心智模型）**：遇到 FastAPI 的任何问题，先问"这是哪一层的问题"——422/文档错乱 → 代码层（查 Pydantic 模型）；吞吐量塌/内存涨 → 框架层（查异步阻塞）；本地能跑上线崩 → 运维层（查 worker/环境变量）。**这个分层最反直觉的地方**：新手把精力全放在框架层（选哪个版本、配中间件），却忽略代码层（Pydantic 模型设计）——而 FastAPI 的灵魂恰恰在代码层。把它换成目录标题你不会改预期，但换成"哪一层出问题"，你排查问题的路径立刻变了。这就是心智模型，不是目录。

这三层不是随便分的，每层对应一个核心技术：代码层 = Pydantic（类型注解是可执行验证逻辑），框架层 = Starlette + ASGI（事件循环、路由、中间件），运维层 = Uvicorn + ASGI 服务器（请求翻译 + worker 部署）。知道这个分层，你就会理解为什么 FastAPI 文档反复强调"异步""Pydantic""ASGI"——它们就是这三层的根基。

---

## §03 演变：Python Web 走了两步（D4 演变层）

理解这个演变，你才知道为什么 FastAPI 这么设计、什么时候该用、什么时候不该。

**第一步：同步时代（~2018）**。Django 和 Flask 统治 Python Web。它们生来同步——一个请求占一个进程或线程，靠多 worker 撑并发。对渲染 HTML 够用，但 I/O 密集场景（调外部 API、查数据库）大量时间在等，线程空转。

**第二步：异步时代（2018~）**。Python 引入 `async/await`，ASGI 协议让单线程能处理大量并发 I/O。Sebastián 把 Starlette（ASGI 工具包）和 Pydantic（类型验证库）组合起来，套一层 Flask 风格的薄接口——这就是 FastAPI。现在它已是 Python 后端框架里增长最快的，并成了 ML 模型服务的事实标准。

最值得关注的近期变化：**Python 3.13 移除了 `crypt` 标准库模块**，直接打破了 `passlib` 这个最常用的密码哈希库（[passlib crypt 依赖问题](https://github.com/passlib/passlib/issues/196)）；**Starlette 1.0 移除了 `@app.on_event`**，改用 `lifespan`；**python-jose 因 CVE-2024-33663/33664 和维护停滞被弃用**，PyJWT 成为 JWT 的事实选择。这类"基础库断裂/迁移"事件会越来越多——盯紧版本，见 §19 反模式清单。

> **什么时候不用 FastAPI**：你需要的是后台任务队列（用 Celery/Dramatiq）、纯 CPU 密集计算（async 帮不上忙，反而更慢）、或需要 Django 那套行政后台+ORM+认证的全栈功能。FastAPI 是 API 优先的框架，不是全栈框架。

---

# 第二部分：上手

## §04 你的第一个 FastAPI（5 分钟看到魔法）

### 痛点：不知道"第一个东西怎么写"

新手最大的卡点不是写不出代码，是不知道最小能跑的入口长什么样。先跑起来，再讲道理。

```python
# main.py
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def read_root():
    return {"Hello": "FastAPI"}
```

启动 + 验证（两个命令，缺一不可）：

```bash
# 装依赖（0.100+ 推荐的一键安装，含 uvicorn 等全家桶）
pip install "fastapi[standard]"
# 启动（含热重载的开发服务器，0.100+ 新增的快捷命令）
fastapi dev main.py
```

打开浏览器看两个东西：
- `http://127.0.0.1:8000/` → 应返回 `{"Hello":"FastAPI"}` ✅
- `http://127.0.0.1:8000/docs` → **这就是 FastAPI 的魔法**：自动生成的 Swagger 交互文档

如果你能看到一个带交互界面、能直接发请求测试的 API 文档页，恭喜，一切正常。这个 `/docs` 不是你写的，是 FastAPI 读你的类型注解**自动生成**的。你以后写的每个带类型注解的端点，都会自动出现在这里。

```
推荐                              不推荐
pip install "fastapi[standard]"  分别装 fastapi + uvicorn[standard]（少装东西，跑起来报缺模块）
fastapi dev main.py（开发热重载） 手动 uvicorn main:app --reload（多敲字、忘了 --reload 没热重载）
在项目目录启动                    在 home 目录裸跑（无项目上下文，后续引入多文件就乱）
```

> **核心建议**：别一上来就纠结项目结构。一个 `main.py` 跑通了，再谈结构——结构是给复杂度服务的，没有复杂度就没有结构。很多人卡在"怎么组织多文件项目"，其实先单文件跑通业务逻辑更重要。

> **过渡叙事**：你刚跑通 `main.py`，初期一个文件够用。但当端点变多、要连数据库、要分团队协作时，继续往一个文件塞就是灾难。§07 会讲"项目该长什么样"——但记住，那是给复杂度准备的，不是 Day 1 就要建的。

---

## §05 用 Pydantic 定义数据（代码层——FastAPI 的灵魂）

### 痛点：你以为在"校验数据"，其实在"定义类型"

为什么写了 `age: int`，FastAPI 不需要任何 `if not isinstance(age, int)` 就自动拒绝字符串？因为 **Pydantic**。FastAPI 把你函数签名的类型注解喂给 Pydantic 做运行时验证——**你的类型注解就是可执行的验证逻辑**，不只是给 IDE 看的。

### 原理（D3 原理层）

FastAPI 用 Python 的 `inspect` 模块读你的端点函数签名 + 类型注解，递归解析子依赖，按正确顺序执行，把结果作为参数注入。请求来时发生这些事：

1. 读签名 → 发现参数 `user: UserCreate`
2. Pydantic 按 `UserCreate` 的字段约束验证请求体
3. 验证不过 → 自动返回 422 + 详细错误（哪个字段、什么错）
4. 验证通过 → 把 `UserCreate` 对象注入函数，`user.name` 可以点出来

知道这个原理，你会做的不同决策：**把约束写在模型里（`Field(ge=0)`），而不是在路由里手写 if 校验**。因为模型里的约束会被 Pydantic 用于验证、被 OpenAPI 用于文档、被 IDE 用于补全——一鱼三吃。手写 if 只能用于验证，还容易漏。

```python
from pydantic import BaseModel, Field
from fastapi import FastAPI

app = FastAPI()

class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    age: int = Field(ge=0, le=150)  # ge=大于等于, le=小于等于

@app.post("/users")
def create_user(user: UserCreate):
    return {"created": user}
```

这一个 `UserCreate` 模型，FastAPI 同时做了 4 件事：验证（age 必须是 0-150 的整数）、文档（Swagger 里 `/users` 的请求体 schema 自动生成）、解析（JSON body 自动转 `UserCreate` 对象）、错误处理（验证不过自动 422）。

### 为什么输入输出要分离

这是新手最容易忽略、但和安全直接相关的点。**返回给客户端的字段，往往不该和接收的一样**。比如创建用户时要密码，但返回时绝不能有密码：

```python
from datetime import datetime

class UserCreate(BaseModel):
    name: str
    password: str  # 接收时需要

class UserResponse(BaseModel):
    name: str
    # 注意：没有 password 字段 → 返回时自动剔除
    created_at: datetime
```

用 `response_model=UserResponse` 声明返回类型，就算你的查询多返回了 password 字段，FastAPI 也会过滤掉。这是最后一道防泄露的闸（详见 §12）。

```
推荐                              不推荐
输入输出分离（UserCreate vs        一个 User 模型用于所有场景（密码会泄露）
  UserResponse）
嵌套模型表达结构（Address 内嵌     用 dict 到处传（没类型、没校验、没补全）
  User）
Field 约束写在模型里               在路由里手写 if 校验（一鱼一吃还容易漏）
用 model_config 配置               全局散落配置
```

> **核心建议**：永远为"输入"和"输出"各定义一个模型。这不是啰嗦，是安全防线——返回模型里没有的字段，就算你手滑塞进去也不会泄露。

### Pydantic v2 进阶：validator、computed_field、Annotated

Pydantic v2（当前 2.13）相比 v1 性能提升 5-50 倍（Rust 核心 pydantic-core），还引入了几个你迟早会用到的能力。

**字段/模型校验器**——在模型层做跨字段或变形校验，而不是在路由里写 if：

```python
from pydantic import BaseModel, field_validator, model_validator
import re

class Signup(BaseModel):
    email: str
    password: str
    confirm: str

    @field_validator("email")
    @classmethod
    def valid_email(cls, v: str) -> str:
        if "@" not in v:
            raise ValueError("邮箱格式不对")
        return v

    @model_validator(mode="after")
    def passwords_match(self) -> "Signup":
        if self.password != self.confirm:
            raise ValueError("两次密码不一致")
        return self
```

`mode="after"` 表示先做完类型转换再校验（拿到的是已转换的对象）；`mode="before"` 表示在类型转换前校验（拿到的是原始输入）。**跨字段校验用 `model_validator`，单字段用 `field_validator`**。

**计算字段**——某个返回值是算出来的，不想存进数据库也不想手写：

```python
from pydantic import BaseModel, computed_field

class Order(BaseModel):
    price: float
    qty: int

    @computed_field
    @property
    def total(self) -> float:
        return self.price * self.qty
    # 序列化时自动出现 total，但不需要外部传入
```

**Annotated 元数据**——把约束和类型绑在一起，可复用（FastAPI 推荐的依赖注入新写法，§06 会用到）：

```python
from typing import Annotated
from pydantic import BaseModel, Field

# 把"非空 1-50 字符的字符串"定义成一个可复用类型
NameStr = Annotated[str, Field(min_length=1, max_length=50)]

class User(BaseModel):
    name: NameStr   # 复用，不用每次写 Field(...)
```

**序列化**——v2 统一用 `model_dump()`（替代 v1 的 `.dict()`），可控制输出：

```python
user.model_dump()              # → dict
user.model_dump(exclude={"password"})  # 排除敏感字段
user.model_dump(mode="json")   # → JSON 可序列化的基本类型（datetime→str）
```

> **核心建议**：能用模型校验器解决的，别在路由里写 if。`@field_validator` / `@model_validator` 把校验逻辑收进模型——它会自动出现在文档里、被 IDE 理解、可在任何地方复用。路由函数只管业务流程，不管数据对不对（数据对不对 Pydantic 已经管了）。

---

## §06 异步与依赖注入（框架层——性能生死线）

### 痛点：写了一样的代码，吞吐量差 10 倍

这是 FastAPI 最容易踩的坑，社区反模式文章反复强调的第一名（[12 FastAPI Anti-Patterns](https://medium.com/@Modexa/12-fastapi-anti-patterns-quietly-killing-throughput-bddaa961634a)）。

```python
import time, asyncio, requests, httpx

# ❌ 阻塞事件循环——一个慢请求拖垮整个服务
@app.get("/slow")
def get_data():           # 同步函数
    time.sleep(5)         # 同步阻塞！整个 worker 卡住
    return {"data": "x"}

# ✅ 正确写法
@app.get("/fast")
async def get_data():     # async 函数
    await asyncio.sleep(5)  # 异步等待，期间可处理其他请求
    return {"data": "x"}
```

### 原理（D3 原理层）

FastAPI 基于 ASGI 事件循环。事件循环是单线程的——它靠"你主动 `await` 让出控制权"来并发处理多个请求。一旦你在 async 函数里调用同步阻塞代码（`time.sleep`、`requests.get`、同步数据库驱动），事件循环被卡住，**所有其他请求跟着排队**。

这就是为什么 FastAPI 强调用异步库：HTTP 请求用 `httpx`（不是 requests）、PostgreSQL 用 `asyncpg`（不是 psycopg2 同步模式）。FastAPI 会自动把同步端点（`def`）丢进线程池跑（via Starlette `run_in_threadpool`），但 async 端点直接跑在事件循环上——**所以 async 里塞同步阻塞代码反而比纯同步 def 更糟**，因为它既占了事件循环线程，又没让出控制权。

**判断标准只有一个**：路由里有没有 I/O 等待。有 → `async def` + 异步库；没有（纯 CPU 计算）→ 普通 `def`（FastAPI 自动丢线程池）。别为了"看起来异步"全加 async——里面若是同步阻塞代码，async 反而更糟。

### 依赖注入：框架层的另一根支柱

依赖注入（DI）是 FastAPI 第二个核心机制。它的本质：**把"资源的获取和清理"从路由里抽出来，框架替你管**。

```python
from fastapi import Depends

async def get_db():
    db = SessionLocal()
    try:
        yield db          # yield 让依赖在请求结束后自动清理
    finally:
        await db.close()

@app.get("/items")
async def list_items(db = Depends(get_db)):  # 声明依赖
    return await db.fetch_all(Item)
```

`Depends` 做的事：FastAPI 用 `inspect` 读函数签名，发现 `db = Depends(get_db)`，请求来时先执行 `get_db()`，把结果传进来，请求结束自动跑 `finally`。你的路由函数只管用 `db`，不管它从哪来、怎么关。

**测试时换掉依赖**（这是 DI 真正的威力）：
```python
app.dependency_overrides[get_db] = get_test_db
```
一行代码，整个应用的数据库换成测试库。不需要 mock 一堆东西（详见 §14）。

### 依赖注入进阶：Annotated 写法、类依赖、作用域

**Annotated 写法（Pydantic v2 / FastAPI 0.95+ 推荐）**——比 `Depends()` 赋值更清晰，且能让 IDE 和类型检查器理解依赖类型：

```python
from typing import Annotated
from fastapi import Depends

# 把依赖定义成一个可复用的类型
DbSession = Annotated[Session, Depends(get_db)]

@app.get("/items")
async def list_items(db: DbSession):   # 直接当类型用，干净
    ...
```

**类作为依赖**——需要带配置或有状态的依赖，用类更合适：

```python
class Paginator:
    def __init__(self, page: int = 1, size: int = 20):
        self.offset = (page - 1) * size
        self.limit = size

@app.get("/items")
async def list_items(p: Paginator = Depends()):  # Depends() 不带参数 → 用类型注解
    return await db.fetch(limit=p.limit, offset=p.offset)
```

**依赖的缓存作用域**——同一个请求里多次用同一个依赖，默认只执行一次（缓存结果）。需要每次都执行（比如每次都要新的 token 解析），用 `use_cache=False`：

```python
async def fresh_token(token: str = Depends(oauth2_scheme, use_cache=False)):
    ...
```

```
推荐                              不推荐
async def + 异步驱动（httpx/       async 函数里调 requests/sleep（阻塞事件循环）
  asyncpg）
有 I/O 的路由用 async def          def 路由里做耗时 I/O（占线程池）
Annotated[T, Depends()] 新写法     散落的 Depends(get_x) 赋值（不可复用、IDE 不认）
Depends + yield 管理资源           全局变量持有连接（并发不安全、无法测试替换）
依赖保持单一职责                   "god-dependency"塞一堆（见坑4）
```

> **核心建议**：依赖项保持单一职责。2026 年 Safeguard 的文章专门点名了"god-dependency"反模式——一个依赖同时做 token 校验+加载用户+权限检查+限流，看似省事，实则无法复用、无法单独测试、改一处牵全身（[Safeguard 2026](https://safeguard.sh/resources/blog/fastapi-authentication-best-practices-2026)）。拆成多个小依赖，用 `Depends` 组合，`current_user = Depends(get_current_user, Depends(require_scope("admin")))`。

---

## §07 项目结构：分层与 APIRouter

### 痛点：一个 main.py 塞到 800 行

跑通 `main.py` 后，下一个坎就是结构。新手常见的两种极端：① 把所有端点、模型、DB 逻辑塞进 `main.py`；② 抄一个七层目录架构，结果根本用不上。社区公认（[zhanymkanov/fastapi-best-practices](https://github.com/zhanymcanov/fastapi-best-practices)，GitHub 高赞）的分层是这样：

```
app/
├── main.py              # 入口：创建 app、挂中间件、include_router
├── core/
│   ├── config.py        # 配置（§08 pydantic-settings）
│   ├── db.py            # 引擎、session、get_db 依赖
│   └── security.py      # 密码哈希、JWT 工具
├── models/              # SQLAlchemy ORM 模型（数据库形状）
│   └── user.py
├── schemas/             # Pydantic 模型（API 形状：入参/出参）
│   └── user.py
├── routers/             # APIRouter：HTTP 端点，只做协议层
│   └── users.py
├── services/            # 业务逻辑（用例编排）
│   └── user_service.py
├── repositories/        # 数据访问（DB CRUD）
│   └── user_repo.py
└── tests/
```

**为什么这么分**——每一层只跟相邻层说话，依赖方向单向（外→内）：

```
HTTP 请求
  ↓
routers（路由层）：解析参数、调 service、返回响应。禁止直接写 SQL。
  ↓
services（业务层）：业务规则、事务边界、调 repo。禁止 import FastAPI。
  ↓
repositories（数据层）：DB CRUD，返回 ORM 模型。
  ↓
models / schemas：数据形状定义
```

**APIRouter 拆分**——每个领域一个 router，在 `main.py` 挂载：

```python
# routers/users.py
from fastapi import APIRouter, Depends
from schemas.user import UserCreate, UserResponse
from services.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"])

@router.post("", response_model=UserResponse)
async def create_user(user: UserCreate, svc: UserService = Depends()):
    return await svc.create(user)
```

```python
# main.py
from fastapi import FastAPI
from routers import users, items

app = FastAPI()
app.include_router(users.router)
app.include_router(items.router)
```

### 边界与变体

这个结构不是教条。**项目小（<10 端点）→ routers + schemas 两层够用，service/repo 可省**。项目大、多人协作 → 全分层，因为 service 层让业务逻辑可单测（不依赖 HTTP）。判断标准：你的业务逻辑是不是开始重复出现"同样的规则在多个端点里写了好几遍"？是 → 抽 service。

**循环导入陷阱**：FastAPI 多文件项目最常见的报错。根因是 `main.py` 和 `routers` 互相 import。解法：`main.py` 只 `include_router`，router 里**不要** `from main import app`——用 `APIRouter` 而不是直接挂 `@app`。

```
推荐                              不推荐
每个领域一个 APIRouter             所有端点塞 main.py（800 行不可维护）
router 只做协议层，调 service       router 里写 SQL/业务规则（混层、无法复用）
models(ORM) 与 schemas(Pydantic)   ORM 模型直接当响应返回（数据库结构泄露给
  分离                              客户端，且耦合 DB）
prefix + tags 给 router 分组        端点路径散落、Swagger 全挤一个 tag
```

> **核心建议**：结构是给复杂度服务的。Day 1 用 `main.py + schemas/` 两层；当业务规则开始重复或团队超 1 人，加 `routers + services + repositories`。判据是"重复"和"协作"，不是"看起来专业"。把 SQLAlchemy ORM 模型和 Pydantic schema 分开（`models/` vs `schemas/`）是少数 Day 1 就该遵守的——直接返回 ORM 模型会把数据库结构泄露给客户端，且让 API 和 DB 死耦合。

---

# 第三部分：核心工程能力

## §08 配置管理：用 pydantic-settings 管环境变量

### 痛点：配置散落在 `os.getenv` 里，改一个值要满代码库找

很多 FastAPI 项目把配置写成 `SECRET = os.getenv("SECRET_KEY")` 散在各处。问题：缺了哪个环境变量只有运行时才崩、没有类型（都是字符串）、没有默认值文档、没法验证。`pydantic-settings`（当前 2.14）一次性解决——它用和 Pydantic 模型一样的语法定义配置，启动时就校验。

```python
# core/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_name: str = "My API"
    database_url: str                      # 必填，没设启动就报错
    secret_key: str                        # 必填
    access_token_expire_minutes: int = 30  # 有默认值
    debug: bool = False

settings = Settings()   # 模块级单例
```

启动时如果 `DATABASE_URL` 没设，**直接报清晰的 ValidationError**，而不是跑到第一个 DB 请求才崩。这是配置管理的核心收益——**把"运行时才发现的配置错误"前移到"启动时"**。

### 概念：为什么用 lru_cache 包 get_settings

直接 `settings = Settings()` 在模块级实例化有个坑：测试时想换配置（比如换测试数据库），但单例已经创建。解法是用 `lru_cache` 包一个工厂函数，测试时清缓存即可替换：

```python
from functools import lru_cache
from fastapi import Depends

@lru_cache
def get_settings() -> Settings:
    return Settings()

# 端点里当依赖用
@app.get("/info")
def info(s: Settings = Depends(get_settings)):
    return {"app": s.app_name}

# 测试时替换配置
get_settings.cache_clear()
```

> **核心建议**：配置集中到一个 `Settings` 类，用 `pydantic-settings`，启动即校验。所有环境变量走 `.env`（开发）和真实环境变量（生产），**绝不硬编码进代码或镜像**（12-factor）。测试时用 `get_settings()` 依赖 + `lru_cache` 清缓存来替换，而不是 mock 全局变量。

---

## §09 数据库：SQLAlchemy 2.0 async

### 痛点：同步 DB 驱动把事件循环卡死

FastAPI 用了异步，但你如果配同步数据库驱动（`psycopg2`），等于在最关键的 I/O 环节自废武功——每次查库都阻塞事件循环。2026 年的标准栈是 **SQLAlchemy 2.0 async + asyncpg**（[FastAPI 官方 SQL 关系型文档](https://fastapi.tiangolo.com/tutorial/sql-databases/)，[2026 标准栈](https://tech-insider.org/fastapi-tutorial-python-rest-api-13-steps-2026/)）。

### 概念：async engine、sessionmaker、yield 依赖

- **engine**：连接池的"工厂"，`create_async_engine` 创建，管理到 PostgreSQL 的一池异步连接。
- **async_sessionmaker**：会话工厂，每次调用产出一个 `AsyncSession`（一次请求一个会话）。
- **yield 依赖**：FastAPI 的 `get_db` 用 `yield` 保证请求结束自动关会话（§06 讲过）。

```python
# core/db.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

from core.config import get_settings

s = get_settings()
engine = create_async_engine(s.database_url, echo=s.debug, pool_size=10, max_overflow=20)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

class Base(DeclarativeBase):
    pass

async def get_db() -> AsyncSession:   # ★ FastAPI 依赖
    async with AsyncSessionLocal() as session:
        yield session
```

### 概念：2.0 的 Mapped / mapped_column 新语法

SQLAlchemy 2.0 推荐用 `Mapped` 类型注解 + `mapped_column` 定义列，比老式 `Column(...)` 更类型安全、IDE 友好：

```python
# models/user.py
from datetime import datetime
from sqlalchemy import String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from core.db import Base

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50))
    email: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

### 在 repository / service 里用

```python
# repositories/user_repo.py
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models.user import User

async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()

async def create_user(db: AsyncSession, user: User) -> User:
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
```

```python
# routers/users.py
from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from core.db import get_db

DbSession = Annotated[AsyncSession, Depends(get_db)]

@router.get("/users/{email}")
async def read_user(email: str, db: DbSession):
    user = await get_user_by_email(db, email)
    return user
```

```
推荐                              不推荐
SQLAlchemy 2.0 async + asyncpg     psycopg2 同步模式（阻塞事件循环）
Mapped/mapped_column 新语法         老式 Column(...)（2.0 已不推荐）
每请求一个 session（yield 依赖）     模块级全局 session（并发串行化、连接泄漏）
expire_on_commit=False             commit 后属性失效报错（异步常见坑）
select() 2.0 风格                  query() 老 API（2.0 已标记 legacy）
```

> **核心建议**：DB 驱动必须异步（asyncpg/aiomysql），否则 FastAPI 的性能优势在数据访问这一层就废了。用 `create_async_engine` + `async_sessionmaker` + `yield` 依赖三件套，每请求一个 session 自动回收。设 `expire_on_commit=False`——这是异步 SQLAlchemy 最常见的报错源（commit 后默认属性过期，异步访问会触发隐式 I/O 报错）。

---

## §10 数据库迁移：Alembic（异步改造）

### 痛点：改了模型，生产数据库怎么跟着变

手写 SQL 迁移脚本很快会失控——谁加了哪个列、回滚怎么办、多人协作冲突怎么办。Alembic（当前 1.18）是 SQLAlchemy 的标准迁移工具，但**它的默认模板是同步的，用在 async 项目里要改造 `env.py`**。

### 操作

```bash
pip install alembic
alembic init migrations        # 生成 migrations/ 目录
```

改 `migrations/env.py`，把 `run_migrations_online` 换成异步版本（[FastAPI 官方 larger apps 示例](https://fastapi.tiangolo.com/tutorial/bigger-applications/)、SQLAlchemy 官方 async Alembic 示例）：

```python
# migrations/env.py 关键改造（异步）
from alembic import context
from sqlalchemy.ext.asyncio import async_engine_from_config
from sqlalchemy import pool
import asyncio
from core.db import Base
import models.user  # noqa: F401  ← 必须导入所有模型，Base.metadata 才知道

target_metadata = Base.metadata

def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()

async def run_async_migrations():
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.", poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()

def run_migrations_online():
    asyncio.run(run_async_migrations())

run_migrations_online()
```

日常用法：

```bash
alembic revision --autogenerate -m "create users table"   # 改了模型后生成迁移
alembic upgrade head                                       # 应用到最新
alembic downgrade -1                                       # 回滚一步
```

> **核心建议**：用 Alembic 管 schema 变更，别手写 SQL 迁移脚本。async 项目必须改造 `env.py`（默认是同步的，直接用会在 `await` 处报错）。`env.py` 里**记得导入所有模型文件**（`import models.user`），否则 `autogenerate` 检测不到模型、生成空迁移——这是最常见的"迁移没生成东西"的原因。生产部署永远 `alembic upgrade head`，别用 `Base.metadata.create_all()`（它不管迁移历史、不能回滚）。

---

## §11 认证授权：OAuth2 + JWT（PyJWT，不是 jose）

### 痛点：认证代码东拼西凑，库还选错了

认证是几乎所有 API 都要做的核心模块，也是坑最密集的地方——选错库（passlib/jose）、密钥管理、token 校验逻辑散落。2026 年的安全标配：密码哈希用 **argon2-cffi**（Py3.13 的 passlib 已废），JWT 用 **PyJWT**（jose 有未修 CVE），见 §19。

### 概念：OAuth2PasswordBearer + OAuth2PasswordRequestForm

- **OAuth2PasswordBearer**：FastAPI 提供的"token 提取器"，声明"这个端点需要从 `Authorization: Bearer <token>` 提取 token"。它还会让你的 `/docs` 出现一个"Authorize"按钮（自动的）。
- **OAuth2PasswordRequestForm**：标准登录表单（`username` + `password`，`application/x-www-form-urlencoded`）。

```python
# core/security.py
from argon2 import PasswordHasher
import jwt
from datetime import datetime, timedelta, timezone
from core.config import get_settings

ph = PasswordHasher()
s = get_settings()

def hash_password(pw: str) -> str:
    return ph.hash(pw)

def verify_password(hash: str, pw: str) -> bool:
    try:
        ph.verify(hash, pw)
        return True
    except Exception:
        return False

def create_access_token(sub: str, expires_minutes: int = 30) -> str:
    payload = {
        "sub": sub,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=expires_minutes),
    }
    return jwt.encode(payload, s.secret_key, algorithm="HS256")
```

```python
# core/auth.py
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
import jwt

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

async def get_current_user(token: str = Depends(oauth2_scheme)) -> "User":
    cred_err = HTTPException(status_code=401, headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = jwt.decode(token, get_settings().secret_key, algorithms=["HS256"])
        name = payload.get("sub")
        if name is None:
            raise cred_err
    except jwt.PyJWTError:
        raise cred_err
    user = await get_user_by_name(name)   # 从 DB 取
    if user is None:
        raise cred_err
    return user
```

### 完整登录 + 受保护资源

```python
# routers/auth.py
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from core.security import verify_password, create_access_token
from core.auth import get_current_user
from core.config import get_settings

router = APIRouter(tags=["auth"])

@router.post("/login")
async def login(form: OAuth2PasswordRequestForm = Depends()):
    user = await get_user_by_name(form.username)
    if not user or not verify_password(user.password_hash, form.password):
        raise HTTPException(401, "用户名或密码错误")
    token = create_access_token(user.name, get_settings().access_token_expire_minutes)
    return {"access_token": token, "token_type": "bearer"}

@router.get("/me")
async def me(current = Depends(get_current_user)):
    return {"name": current.name}
```

### 边界：scopes、refresh token、算法选择

- **scopes（权限）**：`OAuth2PasswordBearer(tokenUrl="login", scopes={"read": "读权限", "write": "写权限"})`，token 里带 scope，`get_current_user` 里校验。比"一个 token 走天下"细。
- **refresh token**：access token 短期（15-30 分钟），refresh token 长期（数天），用 refresh 换新 access。降低 token 泄露风险。
- **算法**：单体服务 `HS256`（对称，共享密钥）够用；微服务/多服务验证 token 用 `RS256`（非对称，公钥验证）。**永远不要用 `none` 算法**（[RFC 7519](https://datatracker.ietf.org/doc/html/rfc7519)，alg=none 攻击是经典 JWT 漏洞）。

```
推荐                              不推荐
argon2-cffi 哈希（Py3.13 兼容）    passlib（Py3.13 ImportError，见 §19 坑2）
PyJWT 2.13 做 token                python-jose（CVE-2024-33663/33664，见 §19 坑3）
OAuth2PasswordBearer 提取 token    手写解析 Authorization 头（漏 edge case）
get_current_user 作为依赖          每个受保护端点各自校验 token（重复、易漏）
token 带 exp + 算法固定            无 exp 的永久 token / 接受 none 算法
```

> **核心建议**：把"提取 token → 解码 → 查用户"封装成一个 `get_current_user` 依赖，受保护端点用 `current = Depends(get_current_user)` 一行搞定。这比每个端点各自校验安全得多（不会漏）。密钥从 `Settings.secret_key` 读，绝不硬编码。token 必带 `exp`，算法固定为 `HS256`/`RS256`，解码时显式传 `algorithms=["HS256"]` 防止 alg 混淆攻击。

---

## §12 错误处理：别返回 200 + 错误信息

### 痛点：返回 200 但其实是错误——客户端根本没法判断

社区反复吐槽的反模式：**统一返回 200，用 body 里的 `code` 字段表示成败**（[Reddit r/FastAPI 讨论](https://www.reddit.com/r/FastAPI/comments/1flft9s/advice_needed_on_error_handling/)）。这违反 HTTP 语义——正确的状态码让中间件、网关、监控、客户端重试逻辑都能正常工作。返回 200 + 错误，等于自废武功。

```python
from fastapi import HTTPException

@app.get("/items/{item_id}")
async def get_item(item_id: int):
    item = await find_item(item_id)
    if item is None:
        # ✅ 用 HTTP 状态码表达错误
        raise HTTPException(status_code=404, detail="Item not found")
    return item
```

### 全局异常处理器：统一错误响应格式

`HTTPException` 够用，但当你有自己的业务异常类（如 `UserNotFound`、`InsufficientBalance`），用全局 `exception_handler` 统一捕获，转成一致的错误响应结构：

```python
# core/exceptions.py
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse

class BusinessError(Exception):
    def __init__(self, code: str, message: str, status: int = 400):
        self.code, self.message, self.status = code, message, status

# main.py
@app.exception_handler(BusinessError)
async def business_error_handler(request: Request, exc: BusinessError):
    return JSONResponse(
        status_code=exc.status,
        content={"error": {"code": exc.code, "message": exc.message}},
    )

# 自定义 422 校验错误格式（默认 FastAPI 的格式很啰嗦）
from fastapi.exceptions import RequestValidationError
from fastapi.encoders import jsonable_encoder

@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"error": {"code": "validation_failed", "details": jsonable_encoder(exc.errors())}},
    )
```

这样所有错误响应都是 `{"error": {"code": ..., "message": ...}}`，客户端解析逻辑统一。

### 响应模型：控制返回什么（防泄露）

`response_model` 是最后一道防泄露的闸——就算你的查询多返回了字段，也不会泄出去：

```python
class ItemOut(BaseModel):
    id: int
    name: str

@app.get("/items/{item_id}", response_model=ItemOut)
async def read_item(item_id: int):
    # 即使返回了含敏感字段的 ORM 对象，response_model 只返回 ItemOut 定义的字段
    return {"id": item_id, "name": "x", "secret": "不该泄露"}
    # 实际返回：{"id": 1, "name": "x"}  ← secret 被过滤
```

```
推荐                              不推荐
用 HTTP 状态码表达成败             统一 200 + body code 字段（破坏 HTTP 语义）
全局 exception_handler 统一格式    每个端点各自 try/except 返回自定义结构
response_model 显式声明返回形状     直接返回 ORM 对象/字典（可能泄露敏感字段）
raise HTTPException / 业务异常      return {"error": ...}（状态码还是 200）
```

> **核心建议**：永远用 `response_model=` 声明返回形状。它是最后一道防泄露的闸——就算查询多返回了字段，也不会泄出去。这条比手写"剔除敏感字段"可靠得多，因为手写会漏。错误用状态码 + 全局 `exception_handler` 统一格式，别用 `200 + code 字段`。

---

## §13 中间件：CORS、请求 ID、自定义逻辑

### 痛点：跨域报错、生产环境日志关联不上

两个最常见的中间件需求：① 前端跨域调你的 API（CORS）；② 一个请求经过多个服务/日志，怎么用 ID 串起来排障（correlation ID）。

### CORS 中间件

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-frontend.com"],  # 生产环境明确列出，别用 ["*"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**关键坑**：`allow_origins=["*"]` + `allow_credentials=True` 是**非法组合**，浏览器会拒绝（[Starlette CORS 文档](https://www.starlette.io/middleware/cors/)）。生产环境必须明确列出允许的源。

### 中间件执行顺序

FastAPI/Starlette 中间件是**洋葱模型**，后添加的先执行请求、后执行响应。顺序很重要：

```python
# 添加顺序 = 请求进入时从外到内执行
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["example.com"])  # 最外
app.add_middleware(HTTPSRedirectMiddleware)                               # 安全层先
app.add_middleware(CORSMiddleware, ...)                                   # CORS
app.add_middleware(RequestIdMiddleware)                                   # 请求 ID（内层）
```

### 自定义中间件：请求 ID / correlation ID

```python
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.request_id = request_id   # 后续日志都能取到
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
```

每个请求生成唯一 ID，塞进 `request.state`，日志都带上它（配合 §17 structlog），排障时一个 ID 串起整个请求链路。

```
推荐                              不推荐
allow_origins 明确列出前端域名     ["*"] + allow_credentials（非法，浏览器拒绝）
安全中间件（TrustedHost/HTTPS）    不加，裸跑（host 攻击、降级到 HTTP）
自定义中间件加请求 ID              日志没关联字段（排障靠猜）
用 @app.middleware 装饰器写简单逻辑 复杂中间件用 BaseHTTPMiddleware（可读、可测）
```

> **核心建议**：CORS 的 `allow_origins` 在生产环境明确列出允许的前端域名，**永远不要 `["*"]` + `allow_credentials=True`**（浏览器直接拒绝，这是最常被坑的 CORS 错误）。加一个请求 ID 中间件，每个请求带唯一 ID 进日志——上线后排障你会发现这是救命的。

---

# 第四部分：进阶与运维

## §14 测试：pytest + httpx + dependency_overrides

### 痛点：测 FastAPI 要不要真起服务器？要连真数据库吗？

FastAPI 的测试不需要真起 uvicorn——用 `TestClient`（基于 `httpx`）直接调 `app` 对象。数据库也不用连真的——用 `dependency_overrides` 把 `get_db` 换成测试库依赖（§06 讲过的 DI 威力）。这是依赖注入真正的回报：**测试时一行代码换掉整个数据库**。

### 操作：TestClient + 换 DB 依赖

```python
# tests/conftest.py
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from main import app
from core.db import get_db, Base

# 用内存 SQLite 做测试库（快、隔离）
test_engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})

@pytest.fixture(autouse=True)
def _reset_overrides():
    yield
    app.dependency_overrides.clear()   # ★ 防跨文件测试污染（假绿坑）

@pytest.fixture
def client():
    Base.metadata.create_all(test_engine)         # 建表
    def override_get_db():
        with Session(test_engine) as session:
            yield session
    app.dependency_overrides[get_db] = override_get_db   # 换 DB 依赖
    with TestClient(app) as c:
        yield c
    Base.metadata.drop_all(test_engine)
```

```python
# tests/test_users.py
def test_create_user(client):
    resp = client.post("/users", json={"name": "alice", "age": 30})
    assert resp.status_code == 200
    assert resp.json()["name"] == "alice"

def test_validation_rejects_bad_age(client):
    resp = client.post("/users", json={"name": "bob", "age": 999})
    assert resp.status_code == 422   # age > 150 被 Pydantic 拒绝
```

### 异步测试

如果你的端点是 `async def` 且要用异步 DB，用 `httpx.AsyncClient` + `anyio`（推荐，比 pytest-asyncio 更贴合 Starlette）：

```python
# pytest 配置 asyncio_mode，或用 anyio_backend fixture
import httpx
import pytest

@pytest.mark.anyio
async def test_async_endpoint():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.get("/items")
    assert r.status_code == 200
```

```python
# pyproject.toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
```

### 测什么（测试金字塔）

- **单元测试（70%）**：service / repository 层，纯业务逻辑，不碰 HTTP。
- **集成测试（20%）**：用 `TestClient` 跑端点 + 测试 DB（如上），验证 HTTP↔业务↔DB 全链路。
- **E2E（10%）**：真环境冒烟测试。

```
推荐                              不推荐
TestClient + dependency_overrides   mock 掉整个 app（测了个寂寞）
内存 SQLite 做测试 DB              连生产/共享开发库跑测试（污染数据）
conftest 里 autouse 清 overrides    不清，测试互相污染（假绿）
测 422 校验路径                     只测 happy path（校验错了上线才发现）
service 层独立单测（不依赖 HTTP）    所有测试都过 TestClient（慢、耦合）
```

> **核心建议**：用 `TestClient` + `dependency_overrides[get_db]` 换测试库——这是 FastAPI 测试的金字招牌，不用 mock 一堆东西就能隔离数据库。**`conftest.py` 里务必加 `app.dependency_overrides.clear()` 的 autouse teardown**——不清理会让 A 测试的 override 污染 B 测试，产生"本地绿、CI 红"的假绿。service 层做独立单元测试（不依赖 HTTP），HTTP 层做集成测试。

---

## §15 后台任务与调度

### 痛点：发邮件、生成报表这种慢操作，放路由里就阻塞了

用户注册后发欢迎邮件——如果在路由里同步发（SMTP 慢），用户要等几秒才看到"注册成功"。这类"请求后要做、但不用等结果"的活儿，就是后台任务。

### BackgroundTasks：轻量级，框架内置

```python
from fastapi import BackgroundTasks

def send_welcome_email(email: str):
    # 同步发邮件逻辑
    ...

@app.post("/register")
async def register(user: UserCreate, bg: BackgroundTasks):
    bg.add_task(send_welcome_email, user.email)   # 请求返回后执行
    return {"status": "registered"}
```

**`BackgroundTasks` 的边界**（必须知道）：任务在**同一个 worker 进程内**、响应返回后执行。① 如果 worker 崩了或重启，**任务丢失**（没持久化）；② 它跑在事件循环里，**长任务/重任务会拖累该 worker 处理新请求**。所以它只适合"短、快、丢了也没事"的活儿（发个邮件、写条日志）。持久化、重试、跨进程——上任务队列。

### 任务队列：Celery / ARQ / Dramatiq

| 工具 | 特点 | 何时选 |
|------|------|--------|
| **Celery** | 生态最成熟、功能全 | 已有 Celery 基础设施、复杂工作流 |
| **ARQ** | 原生 async、基于 Redis | FastAPI 异步项目首选（不阻塞、协程友好） |
| **Dramatiq** | 稳定、API 简洁 | 不想用 Celery 的复杂度 |
| **RQ** | 简单、基于 Redis | 轻量任务、快速上手 |

FastAPI 是异步框架，配异步原生的 **ARQ** 最契合（不会因为任务队列引入同步阻塞）。Celery 4.x+ 也支持异步，但历史包袱重。

```python
# ARQ 任务定义（独立 worker 进程）
from arq import create_pool
from arq.connections import RedisSettings

async def send_email(ctx, email: str):
    await do_send(email)

# FastAPI 端点里入队
from arq import create_pool
@app.post("/register")
async def register(user: UserCreate):
    redis = await create_pool(RedisSettings())
    await redis.enqueue_job("send_email", user.email)
    return {"status": "queued"}
```

### 定时调度：APScheduler

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()

@scheduler.scheduled_job("cron", hour=2)  # 每天凌晨 2 点
async def nightly_report():
    await generate_report()

# 在 lifespan 里启动（不是 @app.on_event——Starlette 1.0 已移除，见坑 5）
@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)

app = FastAPI(lifespan=lifespan)
```

```
推荐                              不推荐
短/快/可丢任务 → BackgroundTasks    所有异步活儿都用它（重任务拖垮 worker）
持久化/重试/重任务 → ARQ/Celery      路由里同步跑长任务（阻塞事件循环）
异步项目优先 ARQ（原生 async）        异步框架配纯同步 Celery（引入阻塞）
定时任务用 APScheduler              用 cron + 独立脚本（散落、难追踪）
```

> **核心建议**：分清两类后台活儿——"短、快、丢了也行"用 `BackgroundTasks`（框架内置、零依赖）；"需要持久化、重试、跨进程、定时"上任务队列。FastAPI 异步项目首选 **ARQ**（原生协程，不阻塞事件循环）。**别用 `BackgroundTasks` 跑关键业务**（如扣款、发短信），worker 一重启任务就没了。

---

## §16 性能与并发：gather、缓存、限流

### 痛点：串行 await 浪费了异步的并发红利

异步的核心红利是"等 I/O 时能干别的"。但如果你在路由里**串行** await 三个独立的 I/O，你还是等了三次——红利全废。

```python
import asyncio, httpx

# ❌ 串行：三个请求总耗时 = A + B + C
async def get_profile(user_id):
    async with httpx.AsyncClient() as c:
        a = await c.get(f".../user/{user_id}")       # 等 0.2s
        b = await c.get(f".../orders/{user_id}")     # 等 0.3s
        c_resp = await c.get(f".../prefs/{user_id}") # 等 0.1s
    return {"user": a, "orders": b, "prefs": c_resp}  # 总 0.6s

# ✅ 并发：三个请求总耗时 = max(A, B, C)
async def get_profile(user_id):
    async with httpx.AsyncClient() as c:
        a, b, c_resp = await asyncio.gather(
            c.get(f".../user/{user_id}"),
            c.get(f".../orders/{user_id}"),
            c.get(f".../prefs/{user_id}"),
        )
    return {"user": a, "orders": b, "prefs": c_resp}  # 总 0.3s
```

**判断标准**：多个**互不依赖**的 I/O → `asyncio.gather` 并发；有依赖（B 要 A 的结果）→ 只能串行。这是异步性能优化里 ROI 最高的一招。

### 缓存：fastapi-cache2

对读多写少、计算贵的端点，加缓存：

```python
from fastapi_cache.decorator import cache

@app.get("/expensive-report/{date}")
@cache(expire=300)   # 缓存 5 分钟
async def report(date: str):
    return await compute_heavy_report(date)   # 第一次慢，之后命中缓存秒回
```

`fastapi-cache2`（当前 0.2.2）支持内存和 Redis 后端，生产用 Redis（多 worker 共享缓存）。

### 限流：slowapi

防刷、防爬、保护下游：

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.get("/search")
@limiter.limit("10/minute")   # 每 IP 每分钟 10 次
async def search(request: Request, q: str):
    return await do_search(q)
```

`slowapi`（当前 0.1.10）基于 limits 库，支持内存和 Redis。生产用 Redis 后端（多 worker 共享计数）。

```
推荐                              不推荐
独立 I/O 用 asyncio.gather 并发     串行 await 独立请求（红利全废）
读多写少端点加 fastapi-cache2       不缓存，每次重算（数据库压力爆）
公开端点加 slowapi 限流             不限流（被爬/被刷爆）
缓存/限流后端用 Redis（多 worker    用内存后端 + 多 worker（各自一份，不准）
  共享）
```

> **核心建议**：异步性能优化的第一招不是"加缓存"，是"把串行 await 改成 `asyncio.gather`"——它免费、零依赖、立竿见影。判断标准：多个互不依赖的 I/O → gather；有依赖 → 串行。公开端点必须限流（`slowapi`），读多写少加缓存（`fastapi-cache2`），两者后端都用 Redis（多 worker 共享，内存后端在多 worker 下计数/缓存都不准）。

---

## §17 可观测性：日志、指标、追踪

### 痛点：上线后出问题，日志是一坨 print，没指标没追踪

可观测性三支柱——**日志（logs）、指标（metrics）、追踪（traces）**。FastAPI 项目上线的标配。

### 结构化日志：structlog

生产日志必须是**结构化的**（JSON），而不是 `print` 或 `f-string`。`structlog`（当前 26.1）让日志带上下文、可被 ELK/Loki 解析：

```python
import structlog
logger = structlog.get_logger()

@app.get("/items/{item_id}")
async def get_item(item_id: int, request: Request):
    logger.info("item_requested", item_id=item_id,
                request_id=request.state.request_id)
    ...
```

输出：`{"event": "item_requested", "item_id": 1, "request_id": "abc-123", "timestamp": "..."}`——机器可解析、可按 `request_id` 过滤、可关联。配合 §13 的请求 ID 中间件，一个请求的所有日志都能串起来。

### 指标：prometheus-fastapi-instrumentator

```python
from prometheus_fastapi_instrumentator import Instrumentator

Instrumentator().instrument(app).expose(app, endpoint="/metrics")
```

一行代码，自动暴露 `/metrics`（Prometheus 抓取格式），含请求数、延迟分位数、状态码分布（`prometheus-fastapi-instrumentator` 当前 8.0.2）。Grafana 配 Prometheus 画面板。

### 追踪：OpenTelemetry

跨服务追踪一个请求经过哪些服务、每段耗时多少：

```python
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

FastAPIInstrumentor.instrument_app(app)
```

OpenTelemetry 自动给每个请求打 span，配 Jaeger/Tempo 看分布式追踪。

```
推荐                              不推荐
structlog 结构化 JSON 日志          print() / f-string（不可解析、无法过滤）
日志带 request_id（关联）           无关联字段（排障靠时间猜）
prometheus-fastapi-instrumentator   手写 /metrics（重复造轮子）
跨服务用 OpenTelemetry              不追踪（多服务时定位慢）
```

> **核心建议**：三支柱按"日志→指标→追踪"顺序上。**日志必须结构化（structlog）+ 带请求 ID**——上线后排障你会发现这是救命的，一个 ID 串起整个请求。指标用 `prometheus-fastapi-instrumentator` 一行接入。追踪（OpenTelemetry）等上了多服务再加。**绝不用 `print`**——它是 unstructured 的，进不了日志系统，等于没有日志。

---

## §18 部署：Docker、Gunicorn、worker 数

### 痛点：本地 `fastapi dev` 跑得好好的，上线就崩

`fastapi dev` / `uvicorn --reload` 是**开发服务器**，不能上生产。生产要用进程管理器（Gunicorn）+ ASGI worker（UvicornWorker），或直接用 Uvicorn 配 systemd/K8s。

### Dockerfile 最佳实践

```dockerfile
# 多阶段构建：构建依赖 和 运行时 分开，镜像更小更安全
FROM python:3.13-slim AS builder
WORKDIR /app
RUN pip install --no-cache-dir uv
COPY pyproject.toml uv.lock ./
RUN uv pip install --system --no-cache .

FROM python:3.13-slim
WORKDIR /app
COPY --from=builder /usr/local/lib/python3.13/site-packages /usr/local/lib/python3.13/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY . .
# 非 root 运行（最小权限）
RUN useradd -m appuser && chown -R appuser /app
USER appuser
EXPOSE 8000
CMD ["gunicorn", "app.main:app", "-w", "1", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000", "--proxy-headers", "--forwarded-allow-ips=*"]
```

### worker 数：异步框架的反模式 ★★★

这是部署 FastAPI 最常被坑的点（§19 坑 4 详细讲）。**不要套用同步框架的 `2*CPU+1`**——那是 Gunicorn + sync worker 的经验值，同步框架靠多进程撑并发。FastAPI 是异步框架，**单进程已能处理大量并发 I/O**，多 worker 只是横向扩展，不是"越多越好"。

```
推荐                              不推荐
容器单 worker，靠 K8s 水平扩 Pod    gunicorn -w 2*CPU+1（内存爆/性能反降）
每个 Pod 一个 worker，CPU 配额隔离  一个容器塞 16 个 worker（抢 CPU）
Gunicorn + UvicornWorker           裸 uvicorn 上生产（无进程管理、崩了不重启）
--proxy-headers + --forwarded-      不加 proxy-headers（拿不到真实客户端 IP）
  allowed-ips=*（在 Nginx 后面）
```

### --proxy-headers：在反向代理后面必须加

生产环境 FastAPI 通常在 Nginx/ALB 后面。不加 `--proxy-headers`，FastAPI 看到的客户端 IP 全是代理的 IP，日志、限流（按 IP）、审计全错。加 `--proxy-headers --forwarded-allow-ips=*`（或明确的代理 IP）让它信任 `X-Forwarded-*` 头（[Gunicorn proxy headers 文档](https://docs.gunicorn.org/en/stable/settings.html#proxy-protocol)）。

### TLS / HTTPS

强制 HTTPS：用 `HTTPSRedirectMiddleware`（§13 提过），或在 Nginx/ALB 层终止 TLS（更推荐，性能更好）。

```
推荐                              不推荐
多阶段 Docker + 非 root 用户        单阶段镜像 + root 运行（被攻破即 root 权限）
容器单 worker + K8s 水平扩          gunicorn -w 9（异步框架内存爆）
--proxy-headers（在代理后面）        不加（日志/限流 IP 全错）
Nginx/ALB 终止 TLS                 应用层做 TLS（性能差）
锁版本（fastapi==0.138.2）          不锁版本（依赖漂移、上线行为变）
```

> **核心建议**：生产用 `Gunicorn + UvicornWorker`（进程管理 + 崩溃重启），**容器里单 worker**，靠 K8s 水平扩 Pod——异步框架不需要 `2*CPU+1`，那套经验来自同步框架，套到 FastAPI 上只会内存爆、性能反降。镜像多阶段构建 + 非 root 用户。在反向代理后面**务必加 `--proxy-headers`**，否则日志和限流的客户端 IP 全是代理的。

---

# 第五部分：避坑与选型

## §19 反模式清单：FastAPI 的坑（你大概率会踩）

每个坑都附"踩坑故事 + 根因 + 推荐做法"，不是干列表。前三条是"基础库断裂/迁移"类（§03 提过）——盯紧版本，这类会越来越多。

### 坑 1：在 async 路由里调用同步阻塞代码 ★★★

**现象**：上线后 QPS 极低，一个慢请求让整个服务卡顿，但本地测试没事。

**根因**：`async def` 路由里调用了 `time.sleep()`、`requests.get()`、同步数据库驱动。事件循环被阻塞，所有请求排队（见 §06 原理）。

**踩坑故事**：开发者把 Flask 的 `requests.get(url)` 原样搬进 `async def`，本地 curl 通过（并发低看不出来），上线压测 QPS 掉到个位数。

```
❌ 不推荐                          ✅ 推荐
async def fetch():                 async def fetch():
    data = requests.get(url)           data = await httpx.AsyncClient().get(url)
```

**影响**：高并发下吞吐量塌方，FastAPI 的性能优势全废。

### 坑 2：密码哈希用 passlib（Py3.13 会崩）★★★

**现象**：升级 Python 3.13 后，`passlib` 报 `ImportError: cannot import name 'crypt'`。

**根因**：Python 3.13 移除了 `crypt` 标准库模块，passlib 依赖它（[passlib issue](https://github.com/passlib/passlib/issues/196)）。

```
❌ 不推荐                          ✅ 推荐
from passlib.context import        from argon2 import PasswordHasher
  CryptContext                     ph = PasswordHasher()
pwd = pwd_ctx.hash(pw)             ph.hash(pw) / ph.verify(hash, pw)
```

argon2-cffi（当前 25.1）是 Argon2（密码哈希竞赛获胜算法）的参考实现，不依赖 crypt。

### 坑 3：JWT 用 python-jose（废弃 + CVE）★★★

**现象**：用了 `python-jose` 做 JWT，但它有未修复的 CVE（CVE-2024-33663/33664），维护停滞。

**根因**：jose 系列库生态衰退，安全通告未修。

```
❌ 不推荐                          ✅ 推荐
from jose import jwt               import jwt  # PyJWT
token = jose_jwt.encode(...)       jwt.encode(payload, key, algorithm="HS256")
```

用 **PyJWT 2.13+**，活跃维护，无已知 CVE。

### 坑 4：worker 数套 2*CPU+1 ★★★

**现象**：按"传统建议"给 Uvicorn 配 `workers = 2*CPU+1`，结果容器里内存爆了或性能反降。

**根因**：`2*CPU+1` 是同步框架（Gunicorn + sync worker）的经验值——同步框架靠多进程撑并发。FastAPI 是异步框架，单进程已能处理大量并发，多 worker 只是横向扩展，不是"越多越好"。一个容器塞 9 个 worker，9 份应用内存 + 抢 CPU 上下文切换，反而更慢。

```
❌ 不推荐                          ✅ 推荐
gunicorn -w 9 -k uvicorn.workers.  容器单 worker，靠 K8s 水平扩 Pod
  UvicornWorker                    （每个 Pod 一个 worker，CPU 配额隔离）
```

### 坑 5：用 @app.on_event（已移除）★★★

**现象**：从老教程抄了 `@app.on_event("startup")`，升级 Starlette 1.0 后报 DeprecationWarning 或直接失效。

**根因**：Starlette 1.0 正式移除了 `on_event`，改用 `lifespan`（[FastAPI lifespan 文档](https://fastapi.tiangolo.com/advanced/events/)）。

```python
# ❌ 旧（已废弃）
@app.on_event("startup")
async def startup():
    await init_db()

# ✅ 新（lifespan）
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()       # 启动时
    yield
    await cleanup_db()    # 关闭时

app = FastAPI(lifespan=lifespan)
```

### 坑 6：测试密码不满足自己的校验规则 ★★

**现象**：文档里 `UserCreate` 要求 `password: Field(min_length=8)`，但示例用 `password="123"`，结果自己写的示例被自己的校验拒绝。

**根因**：写示例时没对照模型的约束。

```
❌ 不推荐                          ✅ 推荐
# 模型要求 min_length=8            # 示例和约束一致
password="123"                     password="correct horse battery"
                                   # 或 "testpass123"
```

### 坑 7：ORM 模型直接当响应返回 ★★

**现象**：直接返回 SQLAlchemy ORM 模型，结果数据库结构（内部字段、关系、密码哈希）泄露给客户端，且 API 和 DB 死耦合。

**根因**：把"数据库形状"和"API 形状"混为一谈。

```
❌ 不推荐                          ✅ 推荐
@app.get("/users/{id}")            @app.get("/users/{id}", response_model=UserResponse)
async def get_user(id):             async def get_user(id):
    return await db.get(User, id)      user = await db.get(User, id)
    # ORM 全字段泄露                    return user  # response_model 过滤
```

### 坑 8：commit 后属性过期报错 ★★

**现象**：异步 SQLAlchemy 里 `await db.commit()` 后访问 `user.name` 报 `MissingGreenlet` 或类似错误。

**根因**：默认 `expire_on_commit=True`，commit 后所有属性标记为过期，异步访问触发隐式刷新 I/O，在异步上下文里报错。

```
❌ 不推荐                          ✅ 推荐
AsyncSessionLocal =                AsyncSessionLocal = async_sessionmaker(
  async_sessionmaker(engine)         engine, expire_on_commit=False)  # ★
```

### 坑 9：BackgroundTasks 跑关键业务 ★★

**现象**：用 `BackgroundTasks` 做扣款/发短信，worker 重启后任务丢了，用户没扣款却收到了服务。

**根因**：`BackgroundTasks` 在 worker 进程内、无持久化，崩了就丢（§15）。

```
❌ 不推荐                          ✅ 推荐
@app.post("/pay")                  @app.post("/pay")
def pay(bg: BackgroundTasks):       async def pay():
    bg.add_task(charge_card, ...)       await redis.enqueue_job("charge", ...)  # ARQ
```

### 坑 10：CORS 用 ["*"] + allow_credentials ★★

**现象**：前端跨域请求被浏览器拒绝，报 CORS 错误。

**根因**：`allow_origins=["*"]` + `allow_credentials=True` 是非法组合（§13）。

```
❌ 不推荐                          ✅ 推荐
CORSMiddleware(                    CORSMiddleware(
  allow_origins=["*"],               allow_origins=["https://app.com"],
  allow_credentials=True)            allow_credentials=True)
```

### 坑 11：依赖里塞一堆（god-dependency）★

**现象**：一个依赖同时做 token 校验+加载用户+权限检查+限流，改一处牵全身，无法单独测试。

**根因**：违反单一职责（§06）。

```
❌ 不推荐                          ✅ 推荐
async def everything(              current_user = Depends(get_current_user)
  token, db, ...):                 admin = Depends(get_current_user,
  # token + 用户 + 权限 + 限流           Depends(require_scope("admin")))
```

### 坑 12：版本不锁，依赖漂移 ★★

**现象**：本地跑得好好的，CI/生产装了新版本（Pydantic 小版本改了行为），上线就崩。

**根因**：`requirements.txt` 用 `fastapi` 不锁版本，或没提交 lock 文件。

```
❌ 不推荐                          ✅ 推荐
requirements.txt:                  requirements.txt / pyproject.toml:
  fastapi                            fastapi==0.138.2
  pydantic                           pydantic==2.13.4
                                     + 提交 uv.lock / poetry.lock
```

> **核心建议**：坑 1-5 是"用了就出事"的硬伤（阻塞、Py3.13 崩、CVE、性能塌方、失效），必须逐条排查你的项目。坑 2/3/5 是"基础库断裂/迁移"类——盯紧版本，这类会越来越多（§03）。**写完代码和示例立刻跑一遍**（坑 6）——示例和约束不一致，读者照抄第一个就崩，对文档的信任归零。

---

## §20 争议：FastAPI 不是银弹（D6 争议层）

### 争议 1：FastAPI 的类型系统 vs Django 的全套生态 ★★★

2026 年 Python 后端圈的核心争议。

**A 方观点（FastAPI 派）**：FastAPI 的类型系统碾压 DRF 的 Serializer。Kevin Gabeci 的对比直言"FastAPI 的类型系统优于 Django REST Framework 的 Serializer"（[Kevin Gabeci](https://kgabeci.medium.com/django-vs-fastapi-in-2026-b93f5a61ad17)）。高并发下快 5-10 倍。现代 Python 项目就该用现代框架。

**B 方观点（Django 派）**：Django 的 ORM + 迁移 + 行政后台是"特性不是局限"。Loopwerk 的文章直接叫板"为什么我仍然选 Django"（[Loopwerk](https://www.loopwerk.io/articles/2024/django-vs-flask-vs-fastapi/)）。一个迁回 Django 的工程师说："FastAPI 的 SQLAlchemy 灵活但要手写太多，Django ORM 开箱即用"。

**判断**：这不是谁替代谁的问题，是**场景匹配**。纯 API 服务（尤其 ML 模型服务、微服务、高并发）→ FastAPI 完胜；需要行政后台、复杂权限系统、完整 Web 功能 → Django 省 weeks。别被"FastAPI 更现代"绑架，看你的实际需求。

### 争议 2：SQLAlchemy 还是 SQLModel ★★

FastAPI 生态里两个主流 ORM 选择。

**SQLAlchemy 2.0 async**：成熟、灵活、生态完善，是 2026 年 FastAPI 项目的默认选择（§09）。但要手写模型、手配 async session。

**SQLModel**（当前 0.0.39，也是 Sebastián 写的）：把 Pydantic 和 SQLAlchemy 合二为一，模型定义更简洁。但相对年轻（注意仍是 0.0.x），复杂查询能力不如纯 SQLAlchemy。

**判断**：新项目、模型简单 → SQLModel 上手快；生产项目、查询复杂 → SQLAlchemy 2.0 async 更稳。两者不冲突，可以先用 SQLModel 验证模式，复杂化了再迁。

### 争议 3：异步真的总是更快吗 ★★

FastAPI 的核心卖点之一是异步性能。但 Reddit 上有人质疑："异步只在 I/O 密集时有用，CPU 密集任务反而更慢。"这是对的——`async` 不是万能加速器。

**判断**：你的瓶颈是 I/O（数据库、外部 API、文件）→ async 显著提效；你的瓶颈是 CPU（图像处理、加密、计算）→ async 帮不上忙，反而开销更大，该用同步 + 线程池或独立进程。别为了"看起来异步"把所有路由加 async。

> **核心建议**：FastAPI 的"快"是有条件的——I/O 密集 + 正确使用异步库。盲目加 async、盲目选 FastAPI，都可能适得其反。先搞清楚你的瓶颈在哪，再决定框架和异步策略。

---

## §21 方向：FastAPI 生态往哪走（D7 方向层）

不是所有变化都值得追。这三个信号值得盯：

### 信号 1：FastAPI + Pydantic v2 + SQLAlchemy 2.0 async 已成标准栈 ★★★

2026 年的现代 Python Web 栈已经收敛：**FastAPI + Pydantic v2 + SQLAlchemy 2.0 async + asyncpg**（[2026 标准栈](https://tech-insider.org/fastapi-tutorial-python-rest-api-13-steps-2026/)）。新项目直接用这套，别再纠结选型。从 Django/Flask 迁移到这套栈是活跃趋势。

### 信号 2：从 Django/Flask 迁移在加速 ★★

"FastAPI in Production 2026: I Migrated 4 Services" 这类文章说明：性能敏感的服务正在迁向 FastAPI。但迁移有成本——别为了"追新"迁移稳定运行的老系统。迁移的判断标准：现有框架是否成了性能瓶颈？是 → 迁；不是 → 别折腾。

### 信号 3：0.xx 版本号何时终结 ★

FastAPI 至今 0.138.2，按语义化版本意味着可能随时有破坏性变更。锁定版本 + 升级前看 [release notes](https://fastapi.tiangolo.com/release-notes/) 是必须的。1.0 正式版会是一个里程碑——意味着 API 稳定性承诺。Pydantic v3 也是值得关注的演进方向。

### 会被淘汰的做法（盯紧）

- `@app.on_event`（Starlette 1.0 已移除）→ `lifespan`
- `passlib`（Py3.13 崩）→ `argon2-cffi`
- `python-jose`（CVE + 停滞）→ `PyJWT`
- 同步 DB 驱动（`psycopg2`）→ 异步（`asyncpg`）
- `query()` 老 API（SQLAlchemy 2.0 legacy）→ `select()`

> **核心建议**：别追每个小版本。每月看一次 [release notes](https://fastapi.tiangolo.com/release-notes/)，关注 breaking changes 和大特性即可。新项目直接上标准栈（Pydantic v2 + SQLAlchemy 2.0 async）。**优先把"会被淘汰的做法"从项目里清掉**——它们不是"还能用"，是"下一个版本就崩"。

---

# 第六部分：实战

## §22 实战项目：从零做带认证 + 数据库的 API（教程模式）

> 学完这个，你就把 FastAPI 的核心能力（Pydantic + 异步 + 依赖注入 + 配置 + 数据库 + 认证）串起来了。这是几乎每个 API 都要做的核心模块。

### 项目选型

做一个**用户注册 + 登录 + 受保护资源**的认证 API：注册（密码哈希存 SQLite）→ 登录（验密码 + 发 JWT）→ 用 token 访问 `/me`。涉及 Pydantic 模型、配置管理、SQLAlchemy 异步、依赖注入、密码安全、JWT——FastAPI 工程能力的全链路。

### 第一步：建项目 + 装依赖（2026 标准栈）

```bash
mkdir fastapi-auth-demo && cd fastapi-auth-demo
python -m venv .venv && source .venv/bin/activate
pip install "fastapi[standard]" pyjwt argon2-cffi "sqlalchemy[asyncio]" aiosqlite
```

注意：密码哈希用 `argon2-cffi`（不是 passlib，坑 2），JWT 用 `pyjwt`（不是 jose，坑 3）。

### 第二步：配置（§08）

```python
# core/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")
    secret_key: str = "dev-secret-change-in-prod"   # 生产用环境变量
    database_url: str = "sqlite+aiosqlite:///./app.db"

def get_settings() -> Settings:
    return Settings()
```

### 第三步：数据库（§09）

```python
# core/db.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from core.config import get_settings

engine = create_async_engine(get_settings().database_url)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
```

### 第四步：模型 + schema（§05 §09）

```python
# models.py
from sqlalchemy import String, Integer
from sqlalchemy.orm import Mapped, mapped_column
from core.db import Base

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
```

```python
# schemas.py
from pydantic import BaseModel, Field

class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=8)   # ★ 注意约束

class UserResponse(BaseModel):            # 输出：无密码
    name: str
    id: int

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
```

### 第五步：安全工具（§11）

```python
# core/security.py
from argon2 import PasswordHasher
import jwt
from datetime import datetime, timedelta, timezone
from core.config import get_settings

ph = PasswordHasher()

def hash_password(pw: str) -> str:
    return ph.hash(pw)

def verify_password(h: str, pw: str) -> bool:
    try:
        ph.verify(h, pw)
        return True
    except Exception:
        return False

def create_token(sub: str) -> str:
    payload = {"sub": sub, "exp": datetime.now(timezone.utc) + timedelta(minutes=30)}
    return jwt.encode(payload, get_settings().secret_key, algorithm="HS256")
```

### 第六步：认证依赖（§11）

```python
# core/auth.py
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import jwt
from core.db import get_db
from core.config import get_settings
from models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

async def get_current_user(token: str = Depends(oauth2_scheme),
                           db: AsyncSession = Depends(get_db)) -> User:
    cred_err = HTTPException(401, "无效凭证", headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = jwt.decode(token, get_settings().secret_key, algorithms=["HS256"])
        name = payload.get("sub")
    except jwt.PyJWTError:
        raise cred_err
    user = (await db.execute(select(User).where(User.name == name))).scalar_one_or_none()
    if user is None:
        raise cred_err
    return user
```

### 第七步：端点 + 启动建表

```python
# main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.db import get_db, Base, engine
from core.security import hash_password, verify_password, create_token
from core.auth import get_current_user, oauth2_scheme
from models import User
from schemas import UserCreate, UserResponse, Token

@asynccontextmanager
async def lifespan(app: FastAPI):       # ★ lifespan（不是 on_event，坑 5）
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(lifespan=lifespan)

@app.post("/register", response_model=UserResponse)
async def register(user: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = (await db.execute(select(User).where(User.name == user.name))).scalar_one_or_none()
    if existing:
        raise HTTPException(400, "用户已存在")
    db_user = User(name=user.name, password_hash=hash_password(user.password))
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user

@app.post("/login", response_model=Token)
async def login(form: OAuth2PasswordRequestForm = Depends(),
                db: AsyncSession = Depends(get_db)):
    user = (await db.execute(select(User).where(User.name == form.username))).scalar_one_or_none()
    if not user or not verify_password(user.password_hash, form.password):
        raise HTTPException(401, "用户名或密码错误")
    return Token(access_token=create_token(user.name))

@app.get("/me", response_model=UserResponse)
async def me(current: User = Depends(get_current_user)):
    return current
```

### 第八步：验证（注册 → 登录 → 受保护资源完整闭环）

```bash
fastapi dev main.py
```

```bash
# 1. 注册（密码 testpass123 满足 min_length=8，坑 6）
curl -X POST http://127.0.0.1:8000/register \
  -H "Content-Type: application/json" \
  -d '{"name":"alice","password":"testpass123"}'
# 预期：{"name":"alice","id":1}

# 2. 登录换 token（OAuth2 标准表单格式）
curl -X POST http://127.0.0.1:8000/login \
  -d "username=alice&password=testpass123"
# 预期：{"access_token":"eyJ...","token_type":"bearer"}

# 3. 带 token 访问受保护资源
TOKEN="<把上面的 access_token 粘进来>"
curl http://127.0.0.1:8000/me -H "Authorization: Bearer $TOKEN"
# 预期：{"name":"alice","id":1}
```

每一步都有可验证的成功标志（① 注册返回 id，② 登录返回 token，③ 带 token 拿到用户）。这就叫完整闭环——从注册到受保护资源全链路跑通。

### 第九步：迭代方向

跑通后可以加：refresh token、scopes（权限分级）、真 PostgreSQL（换 `asyncpg`）、Alembic 迁移（§10）、限流（§16）、测试（§14）。每一步都复用本项目的分层模式。

> **核心建议**：这个项目串起了 FastAPI 的核心能力——Pydantic 模型分离、配置管理、SQLAlchemy 异步、依赖注入、密码安全、JWT。底层模式是"模型定义形状 → 依赖注入管理资源（DB/当前用户）→ 端点只管业务逻辑"。掌握这个模式，任何 API 都是它的变体。`/docs` 页面会出现一个 Authorize 按钮——用你的 token 在 Swagger 里直接测受保护端点，这是 FastAPI 自动文档的回报。

---

# 附录 A：检查清单（Checklist）

> 上线前对照勾选。每项可 grep 或看配置验证。

### A.1 编码与模型检查项

- [ ] 所有公开端点函数有类型注解
- [ ] 输入输出模型分离（UserCreate vs UserResponse）
- [ ] Field 约束写在 Pydantic 模型里（不在路由手写 if）
- [ ] 所有受保护端点用 `Depends(get_current_user)`（grep 验证无散落 token 校验）
- [ ] 错误用 HTTP 状态码 + `HTTPException`（grep 验证无 `return {"error":...}` + 200）
- [ ] `response_model=` 显式声明返回形状
- [ ] 测试示例密码满足自己的 `min_length` 约束（坑 6）
- [ ] 配置走 `Settings`，无硬编码密钥/连接串（grep 验证）
- [ ] ORM 模型与 Pydantic schema 分离（`models/` vs `schemas/`）
- [ ] 无 `@app.on_event`（坑 5，grep 验证用 lifespan）

### A.2 架构与异步检查项

- [ ] 依赖方向单向（routers → services → repos → models）
- [ ] router 层不直接写 SQL（grep 验证）
- [ ] `async def` 路由里无同步阻塞调用（坑 1，grep 验证无 `requests.get`/`time.sleep`）
- [ ] HTTP 客户端用 `httpx`（不是 `requests`）
- [ ] 独立 I/O 用 `asyncio.gather` 并发（不串行 await）
- [ ] DB 驱动异步（asyncpg/aiomysql，不是 psycopg2 同步）
- [ ] `expire_on_commit=False`（坑 8）
- [ ] 依赖保持单一职责（无 god-dependency，坑 11）
- [ ] 后台关键业务用任务队列（不是 BackgroundTasks，坑 9）
- [ ] 跨域 `allow_origins` 明确列出（坑 10）

### A.3 安全与运维检查项

- [ ] 密码哈希用 argon2-cffi（不是 passlib，坑 2，grep 验证）
- [ ] JWT 用 PyJWT（不是 python-jose，坑 3，grep 验证）
- [ ] token 带 `exp`，算法固定 `HS256`/`RS256`（禁 `none`）
- [ ] SQL 全部参数化（SQLAlchemy，无字符串拼接）
- [ ] 依赖无已知高危漏洞（`pip-audit` 验证）
- [ ] 生产用 Gunicorn + UvicornWorker，容器单 worker（坑 4）
- [ ] `--proxy-headers`（在反向代理后面）
- [ ] 镜像多阶段构建 + 非 root 用户
- [ ] 版本锁定（`fastapi==0.138.2`，坑 12）
- [ ] 公开端点有限流（slowapi）
- [ ] 日志结构化（structlog）+ 带请求 ID
- [ ] 密钥/证书不进代码库（`.env` 在 `.gitignore`）

---

# 附录 B：迁移指南

### B.1 从 Flask/Django 迁移到 FastAPI

1. **先迁数据模型**：Django ORM / SQLAlchemy 同步模型 → SQLAlchemy 2.0 async（§09）。命令：逐个模型改 `Mapped`/`mapped_column`。验证：`alembic check`。
2. **迁认证**：session 认证 → OAuth2 + JWT（§11）。注意换掉 passlib/jose（坑 2/3）。
3. **迁端点**：`@app.route` → `@app.get/post` + Pydantic 模型。把校验逻辑从路由移到模型（§05）。
4. **迁异步**：同步 I/O → 异步（`requests`→`httpx`，`psycopg2`→`asyncpg`）。判断每个端点该不该 async（§06）。
5. **迁配置**：散落 `os.getenv` → `pydantic-settings`（§08）。
6. **灰度切流**：新旧并行，按路由灰度迁移，监控错误率。

### B.2 常见迁移陷阱

- **陷阱 1：把同步代码原样塞进 async**：Flask 的 `requests.get` 搬进 `async def` 直接阻塞（坑 1）。规避：必须换异步库。
- **陷阱 2：套用 2*CPU+1 worker 数**：从 Gunicorn+Django 迁来，套旧 worker 经验（坑 4）。规避：容器单 worker + 水平扩。
- **陷阱 3：session 认证思维**：FastAPI 无状态 JWT，没有 Flask 的 session。规避：refresh token 机制补上"会话"语义。
- **陷阱 4：以为 async 一定更快**：CPU 密集端点迁过来加 async 反而更慢（争议 3）。规避：按 I/O vs CPU 判断。
- **陷阱 5：on_event 残留**：老代码的 `@app.on_event` 直接搬（坑 5）。规避：全局换 lifespan。

---

# 附录 C：完整骨架（门禁6：从 install 到 curl 通）

> 本附录是可运行性的硬性依据——正文所有 import 链在此自洽。`git init` 风格从零跑通。

### C.1 项目结构

```
fastapi-demo/
├── pyproject.toml
├── .env.example
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py
│   │   ├── db.py
│   │   └── security.py
│   ├── models.py
│   ├── schemas.py
│   └── routers/
│       ├── __init__.py
│       └── users.py
└── tests/
    ├── __init__.py
    ├── conftest.py
    └── test_health.py
```

### C.2 pyproject.toml（版本与 §基线一致）

```toml
[project]
name = "fastapi-demo"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi==0.138.2",
    "uvicorn[standard]==0.49.0",
    "pydantic==2.13.4",
    "pydantic-settings==2.14.2",
    "sqlalchemy[asyncio]==2.0.51",
    "aiosqlite==0.20.0",
    "asyncpg==0.31.0",
    "argon2-cffi==25.1.0",
    "pyjwt==2.13.0",
    "httpx==0.28.1",
]
[project.optional-dependencies]
dev = [
    "pytest==8.*",
    "httpx==0.28.1",
    "anyio==4.14.1",
]
```

### C.3 .env.example

```bash
# cp .env.example .env 后改值
SECRET_KEY=change-me-to-a-long-random-string
DATABASE_URL=sqlite+aiosqlite:///./app.db
DEBUG=true
```

### C.4 app/core/config.py

```python
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    secret_key: str = "dev-secret"
    database_url: str = "sqlite+aiosqlite:///./app.db"
    debug: bool = False

@lru_cache
def get_settings() -> Settings:
    return Settings()
```

### C.5 app/core/db.py

```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.core.config import get_settings

engine = create_async_engine(get_settings().database_url, echo=get_settings().debug)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
```

### C.6 app/models.py

```python
from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from app.core.db import Base

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
```

### C.7 app/schemas.py

```python
from pydantic import BaseModel, Field

class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=8)

class UserResponse(BaseModel):
    id: int
    name: str
```

### C.8 app/core/security.py

```python
from argon2 import PasswordHasher

ph = PasswordHasher()

def hash_password(pw: str) -> str:
    return ph.hash(pw)

def verify_password(h: str, pw: str) -> bool:
    try:
        ph.verify(h, pw)
        return True
    except Exception:
        return False
```

### C.9 app/routers/users.py

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db
from app.core.security import hash_password
from app.models import User
from app.schemas import UserCreate, UserResponse

router = APIRouter(prefix="/users", tags=["users"])

@router.post("", response_model=UserResponse)
async def create_user(user: UserCreate, db: AsyncSession = Depends(get_db)):
    exists = (await db.execute(select(User).where(User.name == user.name))).scalar_one_or_none()
    if exists:
        raise HTTPException(400, "用户已存在")
    u = User(name=user.name, password_hash=hash_password(user.password))
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return u
```

### C.10 app/main.py

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.core.db import Base, engine
from app.routers import users
import app.models  # noqa: F401  让 Base.metadata 知道模型

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(lifespan=lifespan)
app.include_router(users.router)

@app.get("/health")
async def health():
    return {"status": "ok"}
```

### C.11 tests/conftest.py（含 dependency_overrides 清理，防假绿）

```python
import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture(autouse=True)
def _reset_overrides():
    yield
    app.dependency_overrides.clear()   # ★ 防跨文件测试污染

@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c
```

### C.12 tests/test_health.py

```python
def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
```

### C.13 启动验证（三行）

```bash
# 1. 启动
cd fastapi-demo && pip install -e ".[dev]" && cp .env.example .env
uvicorn app.main:app --reload
# 2. 验证（另开终端）
curl http://127.0.0.1:8000/health
# 3. 期望输出
# {"status":"ok"}   ← HTTP 200
```

### C.14 骨架自洽性检查

- [ ] C.2 依赖版本号 == 文档基线 == frontmatter
- [ ] C.10 入口能被 `uvicorn app.main:app` 启动
- [ ] C.3 `.env.example` 覆盖所有 config 必填字段（cp 后启动不崩）
- [ ] C.4-C.10 正文每个 import 的函数都能在此找到完整实现
- [ ] C.11 测试含 `dependency_overrides.clear()`（防假绿）
- [ ] C.13 三行命令真实可执行

---

# 附录 D：速查卡（精炼专题）

> 这些主题在正文章节有展开，这里给最小可用片段。

### D.1 文件上传

```python
from fastapi import UploadFile, File

@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    contents = await file.read()   # 异步读
    return {"filename": file.filename, "size": len(contents)}
```

大文件用 `await file.stream` 分块读，避免一次性占内存。

### D.2 流式响应

```python
from fastapi.responses import StreamingResponse

@app.get("/stream")
async def stream():
    async def gen():
        for i in range(10):
            yield f"chunk {i}\n"
    return StreamingResponse(gen(), media_type="text/plain")
```

### D.3 WebSocket

```python
from fastapi import WebSocket, WebSocketDisconnect

@app.websocket("/ws/{client_id}")
async def ws(ws: WebSocket, client_id: str):
    await ws.accept()
    try:
        while True:
            data = await ws.receive_text()
            await ws.send_text(f"echo {client_id}: {data}")
    except WebSocketDisconnect:
        pass
```

### D.4 安全头部

```python
from starlette.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        resp = await call_next(request)
        resp.headers["X-Content-Type-Options"] = "nosniff"
        resp.headers["X-Frame-Options"] = "DENY"
        resp.headers["Strict-Transport-Security"] = "max-age=31536000"
        return resp

app.add_middleware(SecurityHeadersMiddleware)
# 或用 HTTPSRedirectMiddleware 强制 HTTPS（§13/§18）
```

### D.5 API 版本化

```python
# URL 前缀版本化（最常用，最直观）
from fastapi import APIRouter

v1 = APIRouter(prefix="/api/v1")
v2 = APIRouter(prefix="/api/v2")

@v1.get("/items")
async def items_v1(): ...   # 旧版，保持向后兼容

@v2.get("/items")
async def items_v2(): ...   # 新版

app.include_router(v1)
app.include_router(v2)
```

策略：URL 前缀（`/api/v1`）最直观、最易调试；Header/MediaType 版本化更"RESTful"但调试难。新项目用 URL 前缀即可。

---

# 附录 E：参考资源（已逐条核实可访问）

**官方**
- [FastAPI 官方文档](https://fastapi.tiangolo.com/) — 文档质量是框架卖点
- [FastAPI Release Notes](https://fastapi.tiangolo.com/release-notes/) — 版本基线来源（0.138.x）
- [FastAPI SQL 关系型文档](https://fastapi.tiangolo.com/tutorial/sql-databases/) — SQLAlchemy async 官方示例
- [FastAPI lifespan 文档](https://fastapi.tiangolo.com/advanced/events/) — lifespan 替代 on_event
- [FastAPI bigger applications](https://fastapi.tiangolo.com/tutorial/bigger-applications/) — APIRouter 分层
- [PyPI fastapi](https://pypi.org/project/fastapi/) — 版本核实（0.138.2）

**社区最佳实践**
- [FastAPI Best Practices (Auth0)](https://auth0.com/blog/fastapi-best-practices/) — 架构模式与测试
- [zhanymkanov/fastapi-best-practices](https://github.com/zhanymcanov/fastapi-best-practices) — 社区约定（GitHub 高赞，分层架构来源）
- [12 FastAPI Anti-Patterns (Modexa)](https://medium.com/@Modexa/12-fastapi-anti-patterns-quietly-killing-throughput-bddaa961634a) — 反模式素材
- [Common FastAPI Anti-Patterns (Plain English)](https://python.plainenglish.io/common-fastapi-anti-patterns-what-to-avoid-for-production-ready-apis-651066b6aab1) — 生产反模式
- [FastAPI Authentication Best Practices 2026 (Safeguard)](https://safeguard.sh/resources/blog/fastapi-authentication-best-practices-2026) — god-dependency 反模式

**对比与争议**
- [Evrone - Sebastián Ramírez 访谈](https://evrone.com/blog/sebastian-ramirez-interview) — 设计哲学引言
- [Django vs FastAPI 2026 (Plain English)](https://python.plainenglish.io/django-vs-fastapi-in-2026-which-framework-should-you-choose-30ce2e1b6e32) — 5-10x 性能基准
- [Kevin Gabeci - Django vs FastAPI 2026](https://kgabeci.medium.com/django-vs-fastapi-in-2026-b93f5a61ad17) — 类型系统 vs Serializer
- [JetBrains: Django/Flask/FastAPI 对比](https://blog.jetbrains.com/pycharm/2025/02/django-flask-fastapi/) — 局限性 + star 增长
- [Level Up Coding - 迁移实录](https://levelup.gitconnected.com/fastapi-vs-django-in-2026-i-moved-3-production-services-heres-what-happened-1adef750c5de) — ORM 是特性不是局限
- [Loopwerk - 为什么仍选 Django](https://www.loopwerk.io/articles/2024/django-vs-flask-vs-fastapi/) — 反方观点

**库文档**
- [Pydantic v2 文档](https://docs.pydantic.dev/2.0/) — validator/computed_field/Annotated
- [pydantic-settings](https://docs.pydantic.dev/latest/concepts/pydantic_settings/) — BaseSettings
- [SQLAlchemy 2.0 async](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html) — 异步 ORM
- [Alembic](https://alembic.sqlalchemy.org/en/latest/cookbook.html#using-asyncio-with-alembic) — 异步迁移
- [PyJWT](https://pyjwt.readthedocs.io/) — JWT
- [argon2-cffi](https://argon2-cffi.readthedocs.io/) — 密码哈希
- [Starlette CORS](https://www.starlette.io/middleware/cors/) — CORS 中间件
- [Gunicorn settings](https://docs.gunicorn.org/en/stable/settings.html#proxy-protocol) — proxy-headers
- [FastAPI Tutorial 2026 标准栈](https://tech-insider.org/fastapi-tutorial-python-rest-api-13-steps-2026/) — 方向层素材

---

> **这份指南的具体 API 和版本会过时（FastAPI 还在 0.138.x，Pydantic v3 在路上），但"类型注解驱动 + 异步优先 + 依赖注入"这个核心哲学不会变**。学会用类型系统思考 API、用依赖注入管理资源、用异步榨取 I/O 并发——这个能力在 Python 后端会越来越值钱。盯紧 §21 的"会被淘汰的做法"，把项目里的 passlib/jose/on_event/同步驱动清掉，你就走在了正确的方向上。

---

## 更新日志

| 日期 | 版本 | 变更 | 来源 |
|------|------|------|------|
| 2026-06-30 | 2.0.0 | 完备版：补全配置/DB/迁移/认证/中间件/测试/后台任务/性能/可观测/部署等核心工程能力；反模式扩到 12 条；加检查清单/迁移指南/完整骨架/速查卡；版本基线核实到 0.138.2（PyPI） | PyPI JSON API + 官方文档 + 社区最佳实践 |
| 2026-06-30 | 1.0.0 | 首次生成（橙皮书风格 + 教程模式，644 行） | cc-bestpractice v1.11.1 |
