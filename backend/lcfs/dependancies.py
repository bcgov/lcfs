from lcfs.settings import Settings

# Used for Dependancy Injection
def get_settings() -> Settings:
    return Settings()