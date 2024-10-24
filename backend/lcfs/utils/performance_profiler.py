import cProfile
import contextlib

import pstats


### with profile_performance():
###     result = await self.db.execute(query)
###     transactions = result.scalars().all()
@contextlib.contextmanager
def profile_performance():
    """Developer Util for Profiling functions"""
    pr = cProfile.Profile()
    pr.enable()
    yield
    pr.disable()
    ps = pstats.Stats(pr).sort_stats("cumulative")
    ps.print_stats()
