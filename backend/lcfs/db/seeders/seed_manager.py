import sys

from lcfs.db.seeders import (
    seed_common, seed_dev, seed_prod
)

def seed_database(environment):
    if environment == 'dev':
        seed_common()
        seed_dev()
    elif environment == 'prod':
        seed_common()
        seed_prod()
    else:
        raise ValueError("Unknown environment")

if __name__ == "__main__":
    env = sys.argv[1] if len(sys.argv) > 1 else 'dev'
    seed_database(env)
