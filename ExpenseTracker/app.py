from flask import Flask, request, jsonify
import sqlite3
import os

app = Flask(__name__)
DB_FILE = 'expenses.db'

# 解決前端與後端不同 port 造成的跨網域 (CORS) 問題
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

def init_db():
    """初始化資料庫與資料表"""
    # 連線到 SQLite 資料庫（如果檔案不存在，會自動建立 expenses.db）
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # 建立 expenses 資料表
    # id: 主鍵 (自動遞增)
    # amount: 金額 (整數)
    # type: 收支類型 (文字，例如 'income' 或 'expense')
    # date: 日期 (文字，例如 '2023-10-27')
    # note: 備註 (文字)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            amount INTEGER NOT NULL,
            type TEXT NOT NULL,
            date TEXT NOT NULL,
            note TEXT
        )
    ''')
    
    # 儲存變更並關閉連線
    conn.commit()
    conn.close()

# 程式啟動時，先確保資料庫與資料表已經準備好
init_db()

@app.route('/add_expense', methods=['POST'])
def add_expense():
    """處理新增記帳資料的 API"""
    # 確保接收到的資料格式是 JSON
    if not request.is_json:
        return jsonify({"status": "error", "message": "資料格式必須是 JSON"}), 400

    # 解析前端傳來的 JSON 資料
    data = request.get_json()
    
    # 取得各個欄位的值
    amount = data.get('amount')
    type = data.get('type')
    date = data.get('date')
    note = data.get('note', '') # 如果沒有提供備註，預設為空字串

    # 檢查必填欄位是否有值
    if amount is None or not type or not date:
        return jsonify({"status": "error", "message": "缺少必填欄位 (amount, type, date)"}), 400

    try:
        # 連線到資料庫
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        
        # ！！！重要：使用「參數化查詢 (?)」來寫入資料庫！！！
        # 這樣可以有效防止 SQL Injection 攻擊，提升系統安全性
        sql = "INSERT INTO expenses (amount, type, date, note) VALUES (?, ?, ?, ?)"
        cursor.execute(sql, (amount, type, date, note))
        
        # 儲存變更並關閉連線
        conn.commit()
        conn.close()
        
        # 回傳 JSON 格式的成功訊息給前端
        return jsonify({
            "status": "success",
            "message": "資料新增成功！"
        }), 201

    except Exception as e:
        # 若發生例外錯誤，回傳錯誤訊息
        return jsonify({
            "status": "error",
            "message": f"資料庫寫入失敗: {str(e)}"
        }), 500

if __name__ == '__main__':
    # 啟動 Flask 伺服器
    # debug=True: 存檔時會自動重啟，且網頁會顯示詳細錯誤訊息，適合開發使用
    print("🚀 啟動簡易記帳系統 API 伺服器...")
    print("👉 請在瀏覽器或 Postman 測試: http://127.0.0.1:5000/")
    app.run(host='0.0.0.0', port=5000, debug=True)
