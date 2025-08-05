# Dynamic Scheduler Tasks Organization

This document describes the modular task organization structure for the dynamic scheduler.

## Directory Structure

```
dynamic_scheduler.py          # Main scheduler script
tasks/                       # Tasks package directory
├── __init__.py             # Package initializer
├── fuel_code_expiry.py     # Fuel code expiration tasks
├── common.py              # Common utility tasks
└── [future modules...]     # Additional task modules
```

## Task Module Organization

### `tasks/fuel_code_expiry.py`
Handles fuel code expiration notifications and related operations:
- `notify_expiring_fuel_code()` - Send expiry notifications
- `check_expired_fuel_codes()` - Check recently expired codes
- Helper functions for code grouping and validation

### `tasks/common.py`
Common utility and maintenance tasks:
- `test_task()` - Simple test task for validation

## Task Function Requirements

All task functions must:

1. **Accept `db_session` parameter**: 
   ```python
   async def my_task(db_session: AsyncSession):
   ```

2. **Return boolean result**:
   - `True` for success
   - `False` for failure

3. **Use structured logging**:
   ```python
   import structlog
   logger = structlog.get_logger(__name__)
   ```

4. **Handle exceptions gracefully**:
   ```python
   try:
       # Task logic here
       return True
   except Exception as e:
       logger.error(f"Task failed: {e}")
       return False
   ```

## Scheduler Configuration

### Task Function Name Formats

The scheduler supports multiple task function name formats:

1. **Full module path**:
   ```
   "tasks.fuel_code_expiry.notify_expiring_fuel_code"
   ```

2. **Relative module path** (auto-prepends "tasks."):
   ```
   "fuel_code_expiry.notify_expiring_fuel_code"
   ```

3. **Function name only** (searches common modules):
   ```
   "notify_expiring_fuel_code"
   ```

### Database Task Configuration

In your `scheduled_tasks` table, set the `task_function` field to one of the supported formats:

```sql
INSERT INTO scheduled_tasks (name, task_function, schedule, is_enabled) VALUES
('Fuel Code Expiry Check', 'fuel_code_expiry.notify_expiring_fuel_code', '0 9 * * *', true),
('System Health Report', 'notification.send_system_health_report', '0 6 * * 1', true),
('Database Health Check', 'common.database_health_check', '*/15 * * * *', true);
```

## Adding New Task Modules

1. **Create new module file** in the `tasks/` directory:
   ```python
   # tasks/my_new_module.py
   import structlog
   from sqlalchemy.ext.asyncio import AsyncSession

   logger = structlog.get_logger(__name__)

   async def my_new_task(db_session: AsyncSession):
       """
       Description of what this task does.
       
       Args:
           db_session: Database session provided by the scheduler
           
       Returns:
           bool: True if successful, False if failed
       """
       logger.info("Starting my new task")
       
       try:
           # Task implementation here
           return True
       except Exception as e:
           logger.error(f"My new task failed: {e}")
           return False
   ```

2. **Update task imports** in `tasks/__init__.py` if needed for discoverability.

3. **Add to scheduler configuration** using the module path:
   ```
   "my_new_module.my_new_task"
   ```

## Best Practices

### Task Organization
- **Group related tasks** in the same module
- **Use descriptive module names** that reflect functionality
- **Keep modules focused** on a single domain area

### Error Handling
- **Always wrap main logic** in try/catch blocks
- **Log errors with context** using structured logging
- **Return appropriate boolean values** for scheduler tracking

### Database Usage
- **Use the provided session** - don't create new connections
- **Handle transactions properly** - commit or rollback as needed
- **Log database operations** for debugging and monitoring

### Performance
- **Keep tasks lightweight** - avoid long-running operations
- **Use async/await properly** for I/O operations
- **Log execution time** for monitoring task performance

## Example Task Implementation

```python
# tasks/example.py
import structlog
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger(__name__)

async def example_task(db_session: AsyncSession):
    """
    Example task showing best practices.
    
    Args:
        db_session: Database session provided by the scheduler
        
    Returns:
        bool: True if successful, False if failed
    """
    start_time = datetime.now()
    logger.info("Starting example task")
    
    try:
        # Example database operation
        result = await db_session.execute("SELECT COUNT(*) FROM some_table")
        count = result.scalar()
        
        logger.info(f"Processed {count} records")
        
        # Example business logic
        if count > 0:
            # Do something with the data
            logger.info("Task completed successfully")
            return True
        else:
            logger.warning("No records to process")
            return True
            
    except Exception as e:
        logger.error(f"Example task failed: {e}")
        return False
    finally:
        duration = (datetime.now() - start_time).total_seconds()
        logger.info(f"Example task finished in {duration:.2f} seconds")
```

## Migration from Legacy Structure

If you have existing tasks in the old `tasks.py` format:

1. **Move task functions** to appropriate new modules
2. **Update database configurations** to use new module paths
3. **Test thoroughly** before removing legacy imports
4. **Keep legacy module** temporarily for backward compatibility

The scheduler will automatically handle both old and new task function formats during the transition period.