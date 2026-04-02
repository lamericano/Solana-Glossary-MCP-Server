$ErrorActionPreference = "SilentlyContinue"
$clean = "C:\Users\luvn\Desktop\glossary\mcp-clean"

# Remove old attempt
Remove-Item $clean -Recurse -Force 2>$null
New-Item -ItemType Directory $clean -Force | Out-Null

# Copy MCP server source
Copy-Item "examples\mcp-server\src" "$clean\src" -Recurse
Copy-Item "examples\mcp-server\tests" "$clean\tests" -Recurse
Copy-Item "examples\mcp-server\tsconfig.json" "$clean\"
Copy-Item "examples\mcp-server\tsup.config.ts" "$clean\"
Copy-Item "examples\mcp-server\vitest.config.ts" "$clean\"

# Copy docs
Copy-Item "examples\mcp-server\README.md" "$clean\README.md"
Copy-Item "DOCUMENTATION.md" "$clean\"
Copy-Item "LICENSE" "$clean\"

Write-Host "=== Files copied ==="
Get-ChildItem $clean -Recurse -Name
