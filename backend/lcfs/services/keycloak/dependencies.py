import jwt
from jwt.exceptions import JWTException
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from lcfs.db.models import User
from lcfs.web.api.user.schema import TokenData
from lcfs.db.dependencies import get_db_session

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def get_current_user(db: Session = Depends(get_db_session), 
                     token: str = Depends(oauth2_scheme)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, "SECRET_KEY", algorithms=["RS256"])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTException:
        raise credentials_exception
    user = {'username': 'test'} # crud.get_user_by_username(db, username=token_data.username)
    if user is None:
        raise credentials_exception
    return user

