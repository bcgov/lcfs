from starlette.requests import Request


def get_user(request: Request):
    """ gets the User for the current HTTP request """
    return request.user

