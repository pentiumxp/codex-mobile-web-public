using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

internal static class Program
{
    private const int STARTF_USESTDHANDLES = 0x00000100;
    private const int STARTF_USESHOWWINDOW = 0x00000001;
    private const short SW_HIDE = 0;
    private const int CREATE_NO_WINDOW = 0x08000000;
    private const int STD_INPUT_HANDLE = -10;
    private const int STD_OUTPUT_HANDLE = -11;
    private const int STD_ERROR_HANDLE = -12;
    private const uint DUPLICATE_SAME_ACCESS = 0x00000002;
    private const uint INFINITE = 0xffffffff;

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct STARTUPINFO
    {
        public int cb;
        public string lpReserved;
        public string lpDesktop;
        public string lpTitle;
        public int dwX;
        public int dwY;
        public int dwXSize;
        public int dwYSize;
        public int dwXCountChars;
        public int dwYCountChars;
        public int dwFillAttribute;
        public int dwFlags;
        public short wShowWindow;
        public short cbReserved2;
        public IntPtr lpReserved2;
        public IntPtr hStdInput;
        public IntPtr hStdOutput;
        public IntPtr hStdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct PROCESS_INFORMATION
    {
        public IntPtr hProcess;
        public IntPtr hThread;
        public int dwProcessId;
        public int dwThreadId;
    }

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool CreateProcessW(
        string lpApplicationName,
        StringBuilder lpCommandLine,
        IntPtr lpProcessAttributes,
        IntPtr lpThreadAttributes,
        bool bInheritHandles,
        int dwCreationFlags,
        IntPtr lpEnvironment,
        string lpCurrentDirectory,
        ref STARTUPINFO lpStartupInfo,
        out PROCESS_INFORMATION lpProcessInformation);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr GetStdHandle(int nStdHandle);

    [DllImport("kernel32.dll")]
    private static extern IntPtr GetCurrentProcess();

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool DuplicateHandle(
        IntPtr hSourceProcessHandle,
        IntPtr hSourceHandle,
        IntPtr hTargetProcessHandle,
        out IntPtr lpTargetHandle,
        uint dwDesiredAccess,
        bool bInheritHandle,
        uint dwOptions);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern uint WaitForSingleObject(IntPtr hHandle, uint dwMilliseconds);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetExitCodeProcess(IntPtr hProcess, out uint lpExitCode);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(IntPtr hObject);

    public static int Main(string[] args)
    {
        if (args.Length == 1 && args[0] == "--mux-shim-version")
        {
            Console.WriteLine("codex-app-server-mux-shim 2");
            return 0;
        }

        try
        {
            string scriptPath = ResolveMuxScriptPath();
            if (!File.Exists(scriptPath))
            {
                Console.Error.WriteLine("codex-app-server-mux-shim: script not found: " + scriptPath);
                return 1;
            }

            string nodePath = ResolveNodePath();
            if (string.IsNullOrEmpty(nodePath))
            {
                Console.Error.WriteLine("codex-app-server-mux-shim: node.exe not found; set CODEX_MUX_NODE_EXE");
                return 1;
            }

            return RunChild(nodePath, scriptPath, args);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("codex-app-server-mux-shim: " + ex.Message);
            return 1;
        }
    }

    private static string ResolveMuxScriptPath()
    {
        string explicitPath = Environment.GetEnvironmentVariable("CODEX_MUX_SCRIPT_PATH");
        if (!string.IsNullOrWhiteSpace(explicitPath))
        {
            return Path.GetFullPath(Environment.ExpandEnvironmentVariables(explicitPath));
        }

        string exePath = Process.GetCurrentProcess().MainModule.FileName;
        string exeDir = Path.GetDirectoryName(exePath);
        return Path.Combine(exeDir ?? Environment.CurrentDirectory, "codex-app-server-mux.js");
    }

    private static string ResolveNodePath()
    {
        string explicitPath = Environment.GetEnvironmentVariable("CODEX_MUX_NODE_EXE");
        if (IsUsableFile(explicitPath))
        {
            return Path.GetFullPath(Environment.ExpandEnvironmentVariables(explicitPath));
        }

        string programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        string programFilesX86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
        string[] candidates =
        {
            Path.Combine(programFiles, "nodejs", "node.exe"),
            Path.Combine(programFilesX86, "nodejs", "node.exe")
        };

        foreach (string candidate in candidates)
        {
            if (IsUsableFile(candidate))
            {
                return candidate;
            }
        }

        string pathValue = Environment.GetEnvironmentVariable("PATH") ?? string.Empty;
        foreach (string rawDir in pathValue.Split(new[] { ';' }, StringSplitOptions.RemoveEmptyEntries))
        {
            try
            {
                string dir = Environment.ExpandEnvironmentVariables(rawDir.Trim('"'));
                string candidate = Path.Combine(dir, "node.exe");
                if (IsUsableFile(candidate))
                {
                    return candidate;
                }
            }
            catch
            {
                // Ignore malformed PATH entries.
            }
        }

        return null;
    }

    private static bool IsUsableFile(string path)
    {
        return !string.IsNullOrWhiteSpace(path) && File.Exists(Environment.ExpandEnvironmentVariables(path));
    }

    private static int RunChild(string nodePath, string scriptPath, string[] args)
    {
        IntPtr stdin = DuplicateForInheritance(GetStdHandle(STD_INPUT_HANDLE));
        IntPtr stdout = DuplicateForInheritance(GetStdHandle(STD_OUTPUT_HANDLE));
        IntPtr stderr = DuplicateForInheritance(GetStdHandle(STD_ERROR_HANDLE));

        PROCESS_INFORMATION processInfo = new PROCESS_INFORMATION();

        try
        {
            STARTUPINFO startupInfo = new STARTUPINFO();
            startupInfo.cb = Marshal.SizeOf(typeof(STARTUPINFO));
            startupInfo.dwFlags = STARTF_USESTDHANDLES | STARTF_USESHOWWINDOW;
            startupInfo.wShowWindow = SW_HIDE;
            startupInfo.hStdInput = stdin;
            startupInfo.hStdOutput = stdout;
            startupInfo.hStdError = stderr;

            string command = BuildCommandLine(nodePath, scriptPath, args);
            string workingDirectory = Path.GetDirectoryName(scriptPath) ?? Environment.CurrentDirectory;
            bool ok = CreateProcessW(
                nodePath,
                new StringBuilder(command),
                IntPtr.Zero,
                IntPtr.Zero,
                true,
                CREATE_NO_WINDOW,
                IntPtr.Zero,
                workingDirectory,
                ref startupInfo,
                out processInfo);

            if (!ok)
            {
                int error = Marshal.GetLastWin32Error();
                Console.Error.WriteLine("codex-app-server-mux-shim: failed to start node.exe, Win32 error " + error);
                return 1;
            }

            WaitForSingleObject(processInfo.hProcess, INFINITE);

            uint exitCode;
            if (!GetExitCodeProcess(processInfo.hProcess, out exitCode))
            {
                int error = Marshal.GetLastWin32Error();
                Console.Error.WriteLine("codex-app-server-mux-shim: failed to read child exit code, Win32 error " + error);
                return 1;
            }

            return unchecked((int)exitCode);
        }
        finally
        {
            CloseIfValid(processInfo.hThread);
            CloseIfValid(processInfo.hProcess);
        }
    }

    private static IntPtr DuplicateForInheritance(IntPtr handle)
    {
        if (!IsValidHandle(handle))
        {
            return handle;
        }

        IntPtr currentProcess = GetCurrentProcess();
        IntPtr duplicated;
        if (DuplicateHandle(
            currentProcess,
            handle,
            currentProcess,
            out duplicated,
            0,
            true,
            DUPLICATE_SAME_ACCESS))
        {
            return duplicated;
        }

        return handle;
    }

    private static bool IsValidHandle(IntPtr handle)
    {
        return handle != IntPtr.Zero && handle.ToInt64() != -1;
    }

    private static void CloseIfValid(IntPtr handle)
    {
        if (IsValidHandle(handle))
        {
            CloseHandle(handle);
        }
    }

    private static string BuildCommandLine(string nodePath, string scriptPath, string[] args)
    {
        StringBuilder builder = new StringBuilder();
        builder.Append(QuoteArg(nodePath));
        builder.Append(' ');
        builder.Append(QuoteArg(scriptPath));
        foreach (string arg in args)
        {
            builder.Append(' ');
            builder.Append(QuoteArg(arg));
        }

        return builder.ToString();
    }

    private static string QuoteArg(string arg)
    {
        if (arg.Length == 0)
        {
            return "\"\"";
        }

        bool needsQuotes = false;
        foreach (char ch in arg)
        {
            if (char.IsWhiteSpace(ch) || ch == '"')
            {
                needsQuotes = true;
                break;
            }
        }

        if (!needsQuotes)
        {
            return arg;
        }

        StringBuilder quoted = new StringBuilder();
        quoted.Append('"');
        int backslashes = 0;
        foreach (char ch in arg)
        {
            if (ch == '\\')
            {
                backslashes++;
            }
            else if (ch == '"')
            {
                quoted.Append('\\', backslashes * 2 + 1);
                quoted.Append('"');
                backslashes = 0;
            }
            else
            {
                quoted.Append('\\', backslashes);
                quoted.Append(ch);
                backslashes = 0;
            }
        }

        quoted.Append('\\', backslashes * 2);
        quoted.Append('"');
        return quoted.ToString();
    }
}
