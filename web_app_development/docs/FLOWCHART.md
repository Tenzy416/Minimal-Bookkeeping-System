# 流程圖設計 - 校園美食推薦系統

以下文件根據系統的 PRD 與系統架構文件，視覺化呈現使用者的操作動線以及資料在系統內部的流動方式。

## 1. 使用者流程圖（User Flow）

此流程圖描述了從學生進入網站後，可以進行的各種動作與頁面跳轉邏輯。

```mermaid
flowchart LR
    A([使用者開啟網站]) --> B[首頁 - 餐廳列表]
    
    %% 註冊與登入模組
    B --> C{是否已登入？}
    C -->|否| D[點擊右上角 登入/註冊]
    D --> E[填寫帳號密碼並送出]
    E -->|成功| B
    
    %% 瀏覽與搜尋模組
    B --> F[使用搜尋列/篩選器]
    C -->|是| F
    F -->|選擇距離/價格/類別| G[動態或重新載入餐廳列表]
    
    %% 進入詳細頁面
    G --> H[點擊某間特定餐廳]
    B --> H
    
    %% 餐廳資訊與互動
    H --> I[查看詳細資訊、菜單、照片與歷史評論]
    H --> J{是否登入？}
    
    %% 互動功能 (評論與收藏)
    J -->|是| K[撰寫評價與選擇星星數]
    K -->|送出表單| H
    J -->|是| L[點擊「加入收藏」按鈕]
    L -->|成功| H
    
    %% 我的收藏
    C -->|是| M[點擊 個人收藏清單]
    M --> N[查看過去收藏的所有餐廳]
    N -->|點擊餐廳| H
```

## 2. 系統序列圖（Sequence Diagram）

此序列圖以核心功能 **「新增一則餐廳評論」** 為例，描述從使用者操作到資料庫寫入的完整交互過程。

```mermaid
sequenceDiagram
    actor User as 使用者
    participant Browser as 瀏覽器 (視圖/Jinja2)
    participant Route as Flask 路由 (Controller)
    participant Model as 系統模組 (Model)
    participant DB as SQLite (資料庫)

    User->>Browser: 在餐廳頁面填寫短評、選擇星星數並「送出」
    Browser->>Route: POST /restaurants/1/reviews (含表單資料)
    
    %% 邏輯驗證與處置
    Route->>Route: 驗證 session 確認已登入
    Route->>Route: 驗證輸入字數與評分合法性
    
    %% 模型與資料庫通訊
    Route->>Model: 建立 Review 實體 (關聯 User_id 與 Restaurant_id)
    Model->>DB: 執行 INSERT INTO reviews 語句
    DB-->>Model: 回報寫入成功
    Model-->>Route: 傳回成功狀態
    
    %% 回傳畫面
    Route-->>Browser: HTTP 302 Redirect (重新導向) 至 /restaurants/1
    Browser->>Route: GET /restaurants/1
    Route->>Model: 查詢包含剛剛最新的一筆評論資料
    Model-->>Route: 傳回所有評論
    Route->>Browser: 透過 Jinja2 渲染最新完整頁面 HTML
    Browser->>User: 顯示已更新的評論區與成功訊息 (Flash Message)
```

## 3. 功能清單對照表

根據 PRD 定義的 MVP 功能，將其轉換為開發所需的路由路徑與 HTTP 請求方法規劃：

| 功能項目 | 對應 URL 路徑 (暫定) | HTTP 方法 | 說明 |
| --- | --- | --- | --- |
| **首頁 (餐廳列表)** | `/` 或 `/restaurants` | GET | 查詢並列出所有餐廳，或是推薦清單 |
| **關鍵字與條件篩選** | `/restaurants/search` | GET | 根據 `?q=` 或其他篩選條件 (距離/價格) 渲染結果 |
| **進階：會員註冊** | `/register` | GET, POST | GET: 顯示註冊表單 / POST: 處理密碼加密並新建帳號 |
| **進階：會員登入** | `/login` | GET, POST | GET: 顯示登入表單 / POST: 解析帳密並寫入 Session |
| **進階：會員登出** | `/logout` | GET, POST | 清除 Session 狀態並導回首頁 |
| **餐廳詳細資訊** | `/restaurants/<int:id>` | GET | 使用者點進特定餐廳，獲取詳細資訊與此店的歷史評論 |
| **新增評論與評分** | `/restaurants/<int:id>/reviews` | POST | 接收前端表單，將評論寫入資料庫並綁定外鍵關係 |
| **加入或移除收藏** | `/restaurants/<int:id>/favorite` | POST | 切換該使用者對於該餐廳的收藏狀態 |
| **個人專屬收藏頁** | `/favorites` | GET | 顯示目前使用者所有收藏的餐廳列表 |

