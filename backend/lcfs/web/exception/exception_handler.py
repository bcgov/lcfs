from fastapi import HTTPException, FastAPI
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.requests import Request
from starlette.responses import JSONResponse

app = FastAPI()


@app.exception_handler(StarletteHTTPException)
def exception_404_handler(request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={
        "error": {"status_code": exc.status_code, "message": exc.detail}})


class CommonHTTPException(HTTPException):
    def __init__(self, status_code: int, message: str):
        super().__init__(status_code=status_code, detail=message)
