using System;
using System.IO;

namespace LabSOM.Backend.Core.Utils
{
    public static class PythonUtils
    {
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
