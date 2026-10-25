using System;
using System.Diagnostics;
using System.IO;
using System.Text;

// Mini Apps 桌面启动器（C# 5 / .NET Framework 4.x，用 Windows 自带编译器构建，无需安装任何东西）
// 依据自身文件名打开对应应用：调用系统 Edge/Chrome 的应用窗口模式（--app）加载本地页面，
// 找不到浏览器时退回系统默认打开方式。exe 仅为十几 KB 的轻量启动器，无任何网络行为。
static class Launcher
{
    static int Main(string[] args)
    {
        try
        {
            string exeDir = AppDomain.CurrentDomain.BaseDirectory;
            string root = FindRoot(exeDir);
            string selfName = Process.GetCurrentProcess().ProcessName;
            string rel;
            int width, height;
            ResolveApp(selfName, out rel, out width, out height);
            string target = Path.Combine(root, rel);

            // --make-launchers：把自身复制为各应用的中文名启动器（构建脚本调用，便于批处理保持纯 ASCII）
            if (args.Length >= 1 && args[0] == "--make-launchers")
            {
                string selfPath = Process.GetCurrentProcess().MainModule.FileName;
                string[] names = new string[] { "时钟", "待办", "日志", "番茄钟", "倒数日", "密码生成器", "习惯打卡", "记账本", "JSON工具箱", "单位换算", "抽签决定器", "白噪音" };
                foreach (string n in names)
                {
                    File.Copy(selfPath, Path.Combine(exeDir, n + ".exe"), true);
                }
                return 0;
            }

            // --print-info <file>：把解析结果写入文件后退出，用于自动化测试，不打开任何窗口
            if (args.Length >= 2 && args[0] == "--print-info")
            {
                string browser = FindBrowser();
                File.WriteAllText(args[1],
                    "app=" + selfName + "\r\n" +
                    "target=" + target + "\r\n" +
                    "exists=" + File.Exists(target).ToString().ToLowerInvariant() + "\r\n" +
                    "browser=" + (browser == null ? "" : browser) + "\r\n",
                    Encoding.UTF8);
                return 0;
            }

            if (!File.Exists(target)) return 1;

            string url = new Uri(target).AbsoluteUri;
            string browser2 = FindBrowser();
            if (browser2 != null)
            {
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = browser2;
                psi.Arguments = "--app=\"" + url + "\" --window-size=" + width + "," + height;
                psi.UseShellExecute = false;
                Process.Start(psi);
            }
            else
            {
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = target;
                psi.UseShellExecute = true;
                Process.Start(psi);
            }
            return 0;
        }
        catch (Exception)
        {
            return 1;
        }
    }

    // exe 位于 desktop/ 内时应用在上级目录；也兼容被复制到仓库根目录的情况
    static string FindRoot(string exeDir)
    {
        string parent = Path.GetFullPath(Path.Combine(exeDir, ".."));
        if (Directory.Exists(Path.Combine(parent, "apps"))) return parent;
        if (Directory.Exists(Path.Combine(exeDir, "apps"))) return exeDir;
        return parent;
    }

    // 启动器按自身文件名路由到对应应用，未知名字则打开合集首页
    static void ResolveApp(string name, out string rel, out int width, out int height)
    {
        if (name == "时钟") { rel = Path.Combine("apps", "clock", "index.html"); width = 620; height = 800; }
        else if (name == "待办") { rel = Path.Combine("apps", "todo", "index.html"); width = 580; height = 800; }
        else if (name == "日志") { rel = Path.Combine("apps", "journal", "index.html"); width = 740; height = 900; }
        else if (name == "番茄钟") { rel = Path.Combine("apps", "pomodoro", "index.html"); width = 560; height = 820; }
        else if (name == "倒数日") { rel = Path.Combine("apps", "countdown", "index.html"); width = 620; height = 820; }
        else if (name == "密码生成器") { rel = Path.Combine("apps", "password", "index.html"); width = 600; height = 820; }
        else if (name == "习惯打卡") { rel = Path.Combine("apps", "habit", "index.html"); width = 640; height = 880; }
        else if (name == "记账本") { rel = Path.Combine("apps", "expense", "index.html"); width = 680; height = 920; }
        else if (name == "JSON工具箱") { rel = Path.Combine("apps", "json", "index.html"); width = 840; height = 880; }
        else if (name == "单位换算") { rel = Path.Combine("apps", "convert", "index.html"); width = 660; height = 780; }
        else if (name == "抽签决定器") { rel = Path.Combine("apps", "picker", "index.html"); width = 660; height = 840; }
        else if (name == "白噪音") { rel = Path.Combine("apps", "noise", "index.html"); width = 680; height = 800; }
        else { rel = "index.html"; width = 1160; height = 820; }
    }

    // Edge 随 Windows 10/11 分发，作为首选；Chrome 作为备选
    static string FindBrowser()
    {
        string[] candidates = new string[]
        {
            CombineEnv("ProgramFiles(x86)", Path.Combine("Microsoft", "Edge", "Application", "msedge.exe")),
            CombineEnv("ProgramFiles", Path.Combine("Microsoft", "Edge", "Application", "msedge.exe")),
            CombineEnv("ProgramFiles", Path.Combine("Google", "Chrome", "Application", "chrome.exe")),
            CombineEnv("ProgramFiles(x86)", Path.Combine("Google", "Chrome", "Application", "chrome.exe")),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                Path.Combine("Google", "Chrome", "Application", "chrome.exe"))
        };
        foreach (string p in candidates)
        {
            if (p != null && File.Exists(p)) return p;
        }
        return null;
    }

    static string CombineEnv(string varName, string sub)
    {
        string baseDir = Environment.GetEnvironmentVariable(varName);
        if (String.IsNullOrEmpty(baseDir)) return null;
        return Path.Combine(baseDir, sub);
    }
}
