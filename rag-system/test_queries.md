# RAG System Test Queries

This document contains test queries to validate the LCFS RAG system's accuracy and domain filtering capabilities.

## Valid Accounting/Finance Queries

### Basic Accounting Principles
1. **Query**: "What are the fundamental accounting principles?"
   **Expected**: Should mention GAAP principles like revenue recognition, matching, conservatism, materiality

2. **Query**: "Explain the matching principle in accounting"
   **Expected**: Should explain matching expenses with related revenues in the same period

3. **Query**: "What is the revenue recognition principle?"
   **Expected**: Should explain recognizing revenue when earned, not when cash received

4. **Query**: "Define the conservatism principle"
   **Expected**: Should explain choosing methods that don't overstate assets/income, prudent approach

### Financial Statements
5. **Query**: "What are the main components of a balance sheet?"
   **Expected**: Should mention assets, liabilities, and equity; basic accounting equation

6. **Query**: "Explain the difference between assets and liabilities"
   **Expected**: Assets are resources owned, liabilities are obligations owed

7. **Query**: "What is owner's equity?"
   **Expected**: Should explain owner's claim on business assets after liabilities

8. **Query**: "What information does an income statement provide?"
   **Expected**: Should mention revenues, expenses, and net income over a period

### Depreciation and Asset Management
9. **Query**: "What is depreciation and why is it used?"
   **Expected**: Should explain systematic allocation of asset cost over useful life

10. **Query**: "What are the different depreciation methods?"
    **Expected**: Should mention straight-line, declining balance, units of production methods

11. **Query**: "Explain the straight-line depreciation method"
    **Expected**: Should explain equal depreciation amounts over asset's useful life

12. **Query**: "What is accelerated depreciation?"
    **Expected**: Should explain methods like double-declining balance that front-load depreciation

### Tax Accounting
13. **Query**: "What is the difference between financial and tax accounting?"
    **Expected**: Should explain different purposes - financial reporting vs. tax compliance

14. **Query**: "What is MACRS depreciation?"
    **Expected**: Should explain Modified Accelerated Cost Recovery System for tax purposes

15. **Query**: "Explain Section 179 expensing"
    **Expected**: Should explain immediate expensing of qualifying business assets

16. **Query**: "What are tax deductions vs. tax credits?"
    **Expected**: Should explain deductions reduce taxable income, credits reduce tax owed

### Auditing and Internal Controls
17. **Query**: "What is the purpose of an audit?"
    **Expected**: Should explain independent verification of financial statements

18. **Query**: "What are internal controls?"
    **Expected**: Should explain processes to ensure accurate reporting and prevent fraud

19. **Query**: "Explain the audit trail concept"
    **Expected**: Should explain documentation path from transactions to financial statements

20. **Query**: "What is materiality in auditing?"
    **Expected**: Should explain threshold for items that could influence decisions

### Advanced Accounting Topics
21. **Query**: "What is accrual vs. cash basis accounting?"
    **Expected**: Should explain timing differences in recognizing transactions

22. **Query**: "Explain bad debt expense and allowance for doubtful accounts"
    **Expected**: Should explain estimating and accounting for uncollectible receivables

23. **Query**: "What is inventory valuation and why does it matter?"
    **Expected**: Should mention FIFO, LIFO, weighted average methods and impact

24. **Query**: "Explain working capital and its importance"
    **Expected**: Should explain current assets minus current liabilities, liquidity measure

25. **Query**: "What are the different types of business entities for tax purposes?"
    **Expected**: Should mention sole proprietorship, partnership, corporation, LLC structures

## Invalid Queries (Should Be Filtered Out)

### Technology/Programming
26. **Query**: "How do you write a Python function?"
    **Expected**: Should be rejected with domain restriction message

27. **Query**: "What is machine learning?"
    **Expected**: Should be rejected with domain restriction message

28. **Query**: "Explain React hooks"
    **Expected**: Should be rejected with domain restriction message

### General Knowledge
29. **Query**: "What is the weather like today?"
    **Expected**: Should be rejected with domain restriction message

30. **Query**: "Who won the World Cup in 2022?"
    **Expected**: Should be rejected with domain restriction message

31. **Query**: "What is the capital of France?"
    **Expected**: Should be rejected with domain restriction message

### Science/Medicine
32. **Query**: "How does photosynthesis work?"
    **Expected**: Should be rejected with domain restriction message

33. **Query**: "What are the symptoms of diabetes?"
    **Expected**: Should be rejected with domain restriction message

34. **Query**: "Explain quantum physics"
    **Expected**: Should be rejected with domain restriction message

### Sports/Entertainment
35. **Query**: "How do you play basketball?"
    **Expected**: Should be rejected with domain restriction message

36. **Query**: "Who directed the movie Inception?"
    **Expected**: Should be rejected with domain restriction message

37. **Query**: "What are the rules of chess?"
    **Expected**: Should be rejected with domain restriction message

### Food/Cooking
38. **Query**: "How do you bake a chocolate cake?"
    **Expected**: Should be rejected with domain restriction message

39. **Query**: "What ingredients are in pizza?"
    **Expected**: Should be rejected with domain restriction message

40. **Query**: "How do you prepare sushi?"
    **Expected**: Should be rejected with domain restriction message

## Edge Cases (Borderline Queries)

### Business-related but not Accounting
41. **Query**: "How do you write a business plan?"
    **Expected**: Might be accepted (mentions 'business') but should be rejected as not accounting-specific

42. **Query**: "What is marketing strategy?"
    **Expected**: Should be rejected (business but not accounting/finance)

43. **Query**: "How do you manage employees?"
    **Expected**: Should be rejected (business but not accounting/finance)

### Finance-adjacent but not Core Accounting
44. **Query**: "What is cryptocurrency?"
    **Expected**: Borderline - might be accepted due to 'finance' connection but not traditional accounting

45. **Query**: "How do stock options work?"
    **Expected**: Should be accepted (financial instrument)

46. **Query**: "What is real estate investment?"
    **Expected**: Should be accepted (investment/finance topic)

## Test Instructions

1. **Run each valid query (1-25)** and verify:
   - Query is accepted (not filtered out)
   - Answer is relevant to the question
   - Context documents are retrieved (num_documents_reranked > 0)
   - Answer quality matches expected content

2. **Run each invalid query (26-40)** and verify:
   - Query is rejected with domain restriction message
   - `filtered_out: true` in response
   - No documents retrieved (all retrieval counts = 0)

3. **Run edge cases (41-46)** and document:
   - Whether query is accepted or rejected
   - Quality of response if accepted
   - Consider if filtering behavior is appropriate

## Success Criteria

- **Valid queries**: ≥90% should be accepted with relevant answers
- **Invalid queries**: 100% should be filtered out with consistent rejection message
- **Retrieval metrics**: Valid queries should show document retrieval (BM25 > 0, Embedding > 0)
- **Answer quality**: Responses should be factually correct based on knowledge base content
- **Consistency**: Same query should produce same filtering decision every time

## Notes

- Focus on accuracy of domain filtering first, then answer quality
- Document any queries where filtering behavior seems incorrect
- Note any accounting questions that are incorrectly filtered out
- Track response times for performance evaluation