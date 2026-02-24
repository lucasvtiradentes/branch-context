Launch a Python expert agent (Opus) to analyze the repository and return improvement suggestions.

The agent should:
1. Read all files in src/ and tests/ directories
2. Check pyproject.toml, setup files, and config files
3. Analyze for:
   - Code quality and best practices
   - Project structure and organization
   - Testing coverage and quality
   - Error handling
   - Type hints usage
   - Dependencies management
   - Security concerns
   - Performance considerations
   - CI/CD and tooling
   - Dead code

Return a structured analysis with improvements categorized as:
- HIGH priority (critical issues, bugs, security, breaking changes)
- MEDIUM priority (code quality, maintainability, consistency)
- NICE TO HAVE (enhancements, polish, minor improvements)

Be specific with file paths and line numbers when possible. Be concise but thorough.

After the agent returns, display the results in a formatted table for each priority level.
