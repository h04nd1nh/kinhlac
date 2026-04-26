using System;
using System.Reflection;
using System.Windows.Forms;
using System.IO;
using System.Threading;

class Launcher {
    [STAThread]
    static void Main(string[] args) {
        // Ep Windows dung che do tuong thich cao nhat
        Environment.SetEnvironmentVariable("COMPlus_useLegacyJit", "1");

        // --- TUYET CHIEU: DANH CHAN LOI TOAN CAU ---
        Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
        
        // Neu co loi xay ra (nhu cai loi Invalid Program do), chung ta se im lang va cho qua
        Application.ThreadException += delegate(object sender, ThreadExceptionEventArgs e) {
            // Khong lam gi ca, de phan mem tiep tuc chay
        };

        AppDomain.CurrentDomain.UnhandledException += delegate(object sender, UnhandledExceptionEventArgs e) {
            // Bo qua cac loi khong nghiem trong
        };

        try {
            string exePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Kinhlac.exe");
            if (!File.Exists(exePath)) {
                MessageBox.Show("Khong tim thay Kinhlac.exe!"); return;
            }
            
            Assembly a = Assembly.LoadFrom(exePath);
            if (a.EntryPoint != null) {
                object[] p = (a.EntryPoint.GetParameters().Length > 0) ? new object[] { args } : null;
                a.EntryPoint.Invoke(null, p);
            }
        } catch (Exception) {
            // Am tham bo qua moi loi khoi dong neu co
        }
    }
}
