using System;
using System.IO;

namespace LabSOM.Backend.Core.Utils
{
    public static class PythonUtils
    {
        public static string ResolveEnginePath()
        {
            // 1. Check environment variable KNOMAP_ENGINE_PATH if provided
            var envPath = Environment.GetEnvironmentVariable("KNOMAP_ENGINE_PATH");
            if (!string.IsNullOrEmpty(envPath) && Directory.Exists(envPath) && File.Exists(Path.Combine(envPath, "main_engine.py")))
            {
                return envPath;
            }

            // 2. Check /app/engine explicitly when running in container
            if (Directory.Exists("/app/engine") && File.Exists(Path.Combine("/app/engine", "main_engine.py")))
            {
                return "/app/engine";
            }

            // 3. Walk up directory tree starting from BaseDirectory to find 'engine' folder containing main_engine.py
            string? dir = AppDomain.CurrentDomain.BaseDirectory;
            while (!string.IsNullOrEmpty(dir))
            {
                var candidate = Path.Combine(dir, "engine");
                if (Directory.Exists(candidate) && File.Exists(Path.Combine(candidate, "main_engine.py")))
                {
                    return candidate;
                }
                dir = Path.GetDirectoryName(dir);
            }

            return Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "engine");
        }

        public static string GetPythonExecutablePath(string enginePath)
        {
            if (string.IsNullOrEmpty(enginePath))
                return "python";

            // Check for Windows isolated virtual environment
            var winVenv = Path.Combine(enginePath, ".venv", "Scripts", "python.exe");
            if (File.Exists(winVenv))
            {
                return winVenv;
            }

            // Check for Unix/Linux/macOS isolated virtual environment
            var unixVenv = Path.Combine(enginePath, ".venv", "bin", "python");
            if (File.Exists(unixVenv))
            {
                return unixVenv;
            }

            // Fallback to system Python executable
            return "python";
        }
    }
}
