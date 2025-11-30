"""
Run the Storage Site Screener web application.
"""
import uvicorn

if __name__ == "__main__":
    print("=" * 60)
    print("STORAGE SITE SCREENER - WEB UI")
    print("=" * 60)
    print("\n   Starting server at http://localhost:8000")
    print("   Press Ctrl+C to stop\n")

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
