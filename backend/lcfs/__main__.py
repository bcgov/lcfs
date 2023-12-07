import uvicorn

from lcfs.settings import settings


def main() -> None:
    """Entrypoint of the application."""
    try:
        uvicorn.run(
            "lcfs.web.application:get_app",
            workers=settings.workers_count,
            host=settings.host,
            port=settings.port,
            reload=settings.reload,
            log_level=settings.log_level.value.lower(),
            factory=True,
        )
    except Exception as e:
        print(e)


if __name__ == "__main__":
    main()
