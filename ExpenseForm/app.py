# -*- coding: utf-8 -*-
"""
大學生期末專題：極簡記帳系統後端 API (Flask + SQLite)
說明：
1. 本程式不僅提供 RESTful API，還能直接託管同資料夾底下的網頁檔案 (index.html, style.css, script.js)。
2. 資料儲存於 SQLite 資料庫檔案中 (expenses.db)，無須額外安裝資料庫伺服器，非常適合直接於本地端執行展示。
3. 程式碼中附帶詳細中文註解，利於期末專題報告與說明。

執行方法：
在終端機 (Terminal) 執行：python app.py
接著在瀏覽器打開：http://127.0.0.1:5000/
"""

# pyrefly: ignore [missing-import]
from flask import Flask, request, jsonify, send_from_directory
import sqlite3
import os

app = Flask(__name__)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(BASE_DIR, 'expenses.db')

# ----------------------------------------------------
# 解決跨來源資源共用 (CORS) 限制
# ----------------------------------------------------
# 當前端網頁使用其他 Port 或不同的網域開啟時，此設定可允許瀏覽器跨來源請求 API
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

# ----------------------------------------------------
# 資料庫初始化
# ----------------------------------------------------
def init_db():
    """初始化 SQLite 資料庫與建立 expenses 資料表"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # 建立記帳資料表 (expenses)
    # id: 主鍵 (自動遞增)
    # amount: 金額 (整數/浮點數)
    # type: 收支類型 ('income' 代表收入, 'expense' 代表支出)
    # date: 記帳日期 (格式如 '2026-05-25')
    # note: 備註/說明
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            amount REAL NOT NULL,
            type TEXT NOT NULL,
            date TEXT NOT NULL,
            note TEXT
        )
    ''')
    
    # 儲存變更並關閉連線
    conn.commit()
    conn.close()

# 確保在伺服器啟動時，資料表已經被正確建立
init_db()

# ----------------------------------------------------
# 靜態網頁檔案託管路由 (Static File Serving)
# ----------------------------------------------------
# 這能讓前端 HTML/CSS/JS 無須分開架設，直接由 Flask 伺服器提供，避免 CORS 錯誤

@app.route('/')
def serve_index():
    """首頁路由，回傳同目錄下的 index.html"""
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/style.css')
def serve_style():
    """載入 CSS 樣式表"""
    return send_from_directory(BASE_DIR, 'style.css')

@app.route('/script.js')
def serve_script():
    """載入前端 JavaScript 邏輯程式"""
    return send_from_directory(BASE_DIR, 'script.js')

# ----------------------------------------------------
# API 路由實作
# ----------------------------------------------------

@app.route('/add_expense', methods=['POST'])
@app.route('/api/expenses', methods=['POST'])  # 支援前端不同的 API 路徑別名
def add_expense():
    """
    新增記帳資料 API
    接收前端傳來的 JSON 資料，並寫入 SQLite 資料庫
    """
    if not request.is_json:
        return jsonify({"status": "error", "message": "資料格式必須是 JSON"}), 400

    data = request.get_json()
    
    # 解析前端傳送的參數，支援 amount, type, date, note (亦相容 notes 欄位)
    amount = data.get('amount')
    type_ = data.get('type')
    date = data.get('date')
    note = data.get('note') or data.get('notes', '') # 相容 notes 與 note 欄位

    # 驗證必填欄位
    if amount is None or not type_ or not date:
        return jsonify({"status": "error", "message": "缺少必填欄位 (amount, type, date)"}), 400

    # 驗證金額是否為正數且格式正確
    try:
        amount_val = float(amount)
        if amount_val <= 0:
            return jsonify({"status": "error", "message": "交易金額必須大於零"}), 400
    except (ValueError, TypeError):
        return jsonify({"status": "error", "message": "交易金額格式錯誤"}), 400

    # 確保收支類型正確
    if type_ not in ['income', 'expense']:
        return jsonify({"status": "error", "message": "收支類型 (type) 必須為 'income' 或 'expense'"}), 400

    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        
        # 使用參數化查詢防止 SQL Injection 注入攻擊
        sql = "INSERT INTO expenses (amount, type, date, note) VALUES (?, ?, ?, ?)"
        cursor.execute(sql, (amount_val, type_, date, note))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            "status": "success",
            "message": "資料新增成功！"
        }), 201

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"資料庫寫入失敗: {str(e)}"
        }), 500


@app.route('/get_expenses', methods=['GET'])
@app.route('/api/expenses', methods=['GET'])  # 支援前端不同的 API 路徑別名
def get_expenses():
    """
    獲取所有記帳資料 API
    自 SQLite 讀取所有資料，依據日期「由新到舊」排序後，回傳 JSON 清單給前端
    """
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        
        # 依日期由新到舊 (descending)、若日期相同則依 ID 由大到小排序
        sql = "SELECT id, amount, type, date, note FROM expenses ORDER BY date DESC, id DESC"
        cursor.execute(sql)
        rows = cursor.fetchall()
        conn.close()
        
        # 整理成字典清單格式
        expenses_list = []
        for row in rows:
            expenses_list.append({
                "id": row[0],
                "amount": row[1],
                "type": row[2],
                "date": row[3],
                "note": row[4]
            })
            
        return jsonify(expenses_list), 200

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"資料庫讀取失敗: {str(e)}"
        }), 500


@app.route('/summary', methods=['GET'])
@app.route('/api/summary', methods=['GET'])  # 支援前端不同的 API 路徑別名
def get_summary():
    """
    獲取財務統計摘要 API
    自 SQLite 資料庫讀取所有收支數據，計算並回傳總收入、總支出與目前結餘之 JSON 格式
    """
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        
        # 1. 計算總收入 (SUM WHERE type = 'income')
        # 使用參數化查詢，完全防止 SQL 注入安全漏洞
        cursor.execute("SELECT SUM(amount) FROM expenses WHERE type = ?", ('income',))
        income_row = cursor.fetchone()
        total_income = income_row[0] if income_row[0] is not None else 0.0
        
        # 2. 計算總支出 (SUM WHERE type = 'expense')
        cursor.execute("SELECT SUM(amount) FROM expenses WHERE type = ?", ('expense',))
        expense_row = cursor.fetchone()
        total_expense = expense_row[0] if expense_row[0] is not None else 0.0
        
        conn.close()
        
        # 3. 計算目前結餘 (結餘 = 總收入 - 總支出)
        balance = total_income - total_expense
        
        # 回傳統計結果 JSON，結構清晰，極適合前端 fetch 讀取與動態渲染
        return jsonify({
            "total_income": total_income,
            "total_expense": total_expense,
            "balance": balance
        }), 200

    except Exception as e:
        # 例外處理：若資料庫計算失敗則回傳錯誤說明
        return jsonify({
            "status": "error",
            "message": f"統計資料計算失敗: {str(e)}"
        }), 500
@app.route('/delete_expense/<int:expense_id>', methods=['DELETE'])
@app.route('/api/expenses/<int:expense_id>', methods=['DELETE'])
def delete_expense(expense_id):
    """
    刪除指定 ID 的記帳資料 API
    """
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        
        # 檢查該筆資料是否存在
        cursor.execute("SELECT id FROM expenses WHERE id = ?", (expense_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            return jsonify({"status": "error", "message": "找不到該筆記帳紀錄"}), 404
        
        # 執行刪除
        cursor.execute("DELETE FROM expenses WHERE id = ?", (expense_id,))
        conn.commit()
        conn.close()
        
        return jsonify({"status": "success", "message": "紀錄已成功刪除！"}), 200
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"刪除失敗: {str(e)}"
        }), 500


if __name__ == '__main__':
    print("==================================================")
    print("[啟動中] 大學生期末專題：極簡記帳系統 API 伺服器啟動中...")
    print("[網址] 請在瀏覽器打開此網址進行操作: http://127.0.0.1:5000/")
    print("==================================================")
    
    # debug=True: 開發模式，存檔時會自動重啟，方便一邊調試一邊編寫代碼
    app.run(host='0.0.0.0', port=5000, debug=True)
