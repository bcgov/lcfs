import sys
import asyncio

from lcfs.db.seeders.common_seeder import seed_common
from lcfs.db.seeders.dev_seeder import seed_dev
from lcfs.db.seeders.prod_seeder import seed_prod

async def seed_database(environment):
    if environment == 'dev':
        await seed_common()
        await seed_dev()
    elif environment == 'prod':
        await seed_common()
        await seed_prod()
    else:
        raise ValueError("Unknown environment")

if __name__ == "__main__":
    env = sys.argv[1] if len(sys.argv) > 1 else 'dev'
    asyncio.run(seed_database(env))
