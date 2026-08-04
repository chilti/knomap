using LabSOM.Backend.Core.Services;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using System.Diagnostics;

using System.IO;

// Ensure the working directory is the executable's directory (crucial for Start Menu shortcuts)
Directory.SetCurrentDirectory(System.AppContext.BaseDirectory);

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddSingleton<HardwareDetectorService>();
builder.Services.AddSingleton<PreprocessService>();
builder.Services.AddSingleton<InCitesService>();
builder.Services.AddSingleton<SOMEngineService>();
builder.Services.AddSingleton<SemanticService>();

// Allow large matrices (e.g. for SOM Weights)
builder.Services.Configure<Microsoft.AspNetCore.Server.Kestrel.Core.KestrelServerOptions>(options =>
{
    options.Limits.MaxRequestBodySize = int.MaxValue; 
});

// Enable CORS for local SPA frontends (Vite runs on localhost)
builder.Services.AddCors();

bool isHeadless = Environment.GetEnvironmentVariable("DOTNET_RUNNING_IN_CONTAINER") == "true" || args.Contains("--headless");

// Listen on a dynamic local port to avoid collisions ONLY for desktop UI
if (!isHeadless)
{
    builder.WebHost.UseUrls("http://127.0.0.1:0");
}


var app = builder.Build();

// Serve the compiled React frontend from wwwroot
app.UseDefaultFiles();
app.UseStaticFiles();

// Enable CORS
app.UseCors(policy => policy
    .AllowAnyOrigin()
    .AllowAnyHeader()
    .AllowAnyMethod());

// 1. System Hardware Status Endpoint
app.MapGet("/api/system/status", async (HardwareDetectorService detector) =>
{
    var hw = await detector.DetectAsync();
    return Results.Ok(new { success = true, hardware = hw });
});

// 2. Bibliometric Preprocessing Endpoint
app.MapPost("/api/preprocess/bibliometrics", async (HttpRequest req, PreprocessService preprocessor) =>
{
    if (!req.HasFormContentType || req.Form.Files.Count == 0)
    {
        return Results.BadRequest(new { success = false, error = "No file uploaded." });
    }

    var file = req.Form.Files[0];
    
    // Read parameters from form
    var request = new PreprocessRequest
    {
        Network_Type = req.Form["networkType"],
        Custom_Tag = req.Form["customTag"],
        Max_Terms = int.TryParse(req.Form["maxTerms"], out int mt) ? mt : 100,
        Min_Cooccurrence = int.TryParse(req.Form["minCooc"], out int mc) ? mc : 2,
        Only_Major_Mesh = bool.TryParse(req.Form["onlyMajor"], out bool om) ? om : false,
        Temporal = bool.TryParse(req.Form["temporal"], out bool temp) ? temp : false
    };

    var result = await preprocessor.PreprocessBibliometricsWithFileAsync(file, request);
    if (!result.Success)
    {
        return Results.Json(result, statusCode: 500);
    }
    return Results.Ok(result);
});

// 2.5a InCites Upload & Process — returns ONLY unit names (tiny payload)
app.MapPost("/api/incites/process", async (HttpRequest req, InCitesService service) =>
{
    if (!req.HasFormContentType || req.Form.Files.Count == 0)
    {
        return Results.BadRequest(new { success = false, error = "No files uploaded." });
    }

    var files = req.Form.Files.ToList();
    var result = await service.ProcessInCitesFilesAsync(files);
    
    if (!result.Success)
    {
        return Results.Json(result, statusCode: 500);
    }
    return Results.Ok(result); // { success, unit_names: [...] }
});

// 2.5b InCites Get Unit Data — returns ONE unit on demand (small payload)
app.MapGet("/api/incites/unit/{unitName}", async (string unitName, InCitesService service) =>
{
    var result = await service.GetUnitDataAsync(unitName);
    if (!result.Success)
    {
        return Results.Json(new { success = false, error = result.Error }, statusCode: 404);
    }
    // Stream the raw JSON directly to avoid double-serialization overhead
    return Results.Content(
        $"{{\"success\":true,\"unit_name\":\"{unitName}\",\"unit\":{result.UnitDataRaw}}}",
        "application/json");
});


// 3. SOM and UMAP Training Endpoint
app.MapPost("/api/som/train", async (SOMTrainingRequest request, SOMEngineService engine) =>
{
    if (request.Data == null || request.Data.Count == 0)
    {
        return Results.BadRequest(new { success = false, error = "Data matrix is empty or invalid." });
    }
    
    var result = await engine.TrainAsync(request);
    if (!result.Success)
    {
        return Results.Json(result, statusCode: 500);
    }
    return Results.Ok(result);
});

// 4. Evaluate Clustering Endpoint
app.MapPost("/api/som/evaluate_clusters", async (EvaluateClustersRequest request, SOMEngineService engine) =>
{
    if (request.Weights == null || request.Weights.Count == 0)
    {
        return Results.BadRequest(new { success = false, error = "Weights matrix is empty or invalid." });
    }
    
    var result = await engine.EvaluateClustersAsync(request);
    if (!result.Success)
    {
        return Results.Json(result, statusCode: 500);
    }
    return Results.Ok(result);
});

// 5. Recluster Fast Endpoint
app.MapPost("/api/som/recluster", async (ReclusterRequest request, SOMEngineService engine) =>
{
    if (request.Weights == null || request.Weights.Count == 0)
    {
        return Results.BadRequest(new { success = false, error = "Weights matrix is empty or invalid." });
    }
    
    var result = await engine.ReclusterAsync(request);
    if (!result.Success)
    {
        return Results.Json(result, statusCode: 500);
    }
    return Results.Ok(result);
});

// 5. UMAP Projections Endpoint
app.MapPost("/api/som/umap", async (UmapRequest request, SOMEngineService engine) =>
{
    if (request.Weights == null || request.Weights.Count == 0)
    {
        return Results.BadRequest(new { success = false, error = "Weights matrix is empty or invalid." });
    }
    
    var result = await engine.GenerateUmapAsync(request);
    if (!result.Success)
    {
        return Results.Json(result, statusCode: 500);
    }
    return Results.Ok(result);
});

// 6. Dimension Estimation Endpoint
app.MapPost("/api/dim/estimate", async (EstimateDimensionRequest request, SOMEngineService engine) =>
{
    if (request.Data == null || request.Data.Count == 0)
    {
        return Results.BadRequest(new { success = false, error = "Data matrix is empty or invalid." });
    }
    
    var result = await engine.EstimateDimensionAsync(request);
    if (!result.Success)
    {
        return Results.Json(result, statusCode: 500);
    }
    return Results.Ok(result);
});

// 7. Dimension Reduction Endpoint
app.MapPost("/api/dim/reduce", async (ReduceDimensionRequest request, SOMEngineService engine) =>
{
    if (request.Data == null || request.Data.Count == 0)
    {
        return Results.BadRequest(new { success = false, error = "Data matrix is empty or invalid." });
    }
    
    var result = await engine.ReduceDimensionAsync(request);
    if (!result.Success)
    {
        return Results.Json(result, statusCode: 500);
    }
    return Results.Ok(result);
});

// 8. Semantic Bibliometrics Endpoints
app.MapPost("/api/semantic/preprocess", async (HttpRequest req, SemanticService service) =>
{
    if (!req.HasFormContentType || req.Form.Files.Count == 0)
    {
        return Results.BadRequest(new { success = false, error = "No file uploaded." });
    }

    var file = req.Form.Files[0];
    
    // Parse fields
    var extraFieldsRaw = req.Form["extraFields"].ToString() ?? "";
    var extraFields = new List<string>();
    if (!string.IsNullOrWhiteSpace(extraFieldsRaw))
    {
        foreach (var field in extraFieldsRaw.Split(','))
        {
            var trimmed = field.Trim();
            if (!string.IsNullOrEmpty(trimmed)) extraFields.Add(trimmed);
        }
    }

    var request = new SemanticParseRequest
    {
        UseMesh = bool.TryParse(req.Form["useMesh"], out bool um) ? um : true,
        ExtractTitle = !bool.TryParse(req.Form["extractTitle"], out bool et) || et,
        ExtractAbstract = !bool.TryParse(req.Form["extractAbstract"], out bool ea) || ea,
        ExtractKeywords = !bool.TryParse(req.Form["extractKeywords"], out bool ek) || ek,
        ExtraFields = extraFields
    };

    var result = await service.PreprocessSemanticAsync(file, request);
    return Results.Ok(result);
});

app.MapPost("/api/semantic/embed", async (SemanticEmbedRequest request, SemanticService service) =>
{
    if (request.Records == null || request.Records.Count == 0)
    {
        return Results.BadRequest(new { success = false, error = "Records list is empty." });
    }

    var result = await service.GenerateEmbeddingsAsync(request);
    return Results.Ok(result);
});

app.MapPost("/api/semantic/reduce", async (SemanticReduceRequest request, SemanticService service) =>
{
    if (request.Embeddings == null || request.Embeddings.Count == 0)
    {
        return Results.BadRequest(new { success = false, error = "Embeddings list is empty." });
    }

    var result = await service.ReduceDimensionAsync(request);
    return Results.Ok(result);
});

app.MapPost("/api/semantic/cluster", async (SemanticClusterRequest request, SemanticService service) =>
{
    if (request.IntrinsicData == null || request.IntrinsicData.Count == 0)
    {
        return Results.BadRequest(new { success = false, error = "Intrinsic data list is empty." });
    }

    var result = await service.ClusterSemanticAsync(request);
    return Results.Ok(result);
});

// Health check
app.MapGet("/api/health", () => Results.Ok(new { status = "Healthy", app = "newLabSOM Local API" }));

// Start the ASP.NET Core web server in the background
await app.StartAsync();

// Retrieve the dynamically assigned local port
var server = app.Services.GetRequiredService<Microsoft.AspNetCore.Hosting.Server.IServer>();
var addressFeature = server.Features.Get<Microsoft.AspNetCore.Hosting.Server.Features.IServerAddressesFeature>();
var localUrl = addressFeature?.Addresses.FirstOrDefault() ?? "http://127.0.0.1:5000";

Console.WriteLine($"[Backend] API Server running at {localUrl}");


if (isHeadless)
{
    Console.WriteLine("[Backend] Running in headless mode. Press Ctrl+C to shut down.");
    await app.WaitForShutdownAsync();
}
else
{
    // Initialize Photino native desktop window on an STA thread (required for Windows UI)
    var windowThread = new System.Threading.Thread(() =>
    {
        var window = new Photino.NET.PhotinoWindow()
            .SetTitle("Sinapsis Map")
            .SetUseOsDefaultLocation(false)
            .SetUseOsDefaultSize(false)
            .SetSize(1280, 800)
            .Center()
            // .SetIconFile("wwwroot/icon.ico")
            .SetChromeless(true)
            .RegisterWebMessageReceivedHandler((object sender, string message) => {
                var w = (Photino.NET.PhotinoWindow)sender;
                if (message == "window:minimize") w.SetMinimized(true);
                if (message == "window:maximize") {
                    if (WindowDragger.IsZoomed(w.WindowHandle))
                        WindowDragger.ShowWindow(w.WindowHandle, WindowDragger.SW_RESTORE);
                    else
                        WindowDragger.ShowWindow(w.WindowHandle, WindowDragger.SW_MAXIMIZE);
                }
                if (message == "window:close") w.Close();
                if (message == "window:drag") {
                    WindowDragger.ReleaseCapture();
                    WindowDragger.DefWindowProc(w.WindowHandle, WindowDragger.WM_SYSCOMMAND, (UIntPtr)WindowDragger.MOUSE_MOVE, IntPtr.Zero);
                }
            })
            .Load(localUrl);

#if DEBUG
        window.SetDevToolsEnabled(true);
#else
        window.SetDevToolsEnabled(false);
#endif

        window.RegisterWindowCreatedHandler((object sender, EventArgs e) => 
        {
            if (System.Runtime.InteropServices.RuntimeInformation.IsOSPlatform(System.Runtime.InteropServices.OSPlatform.Windows))
            {
                var w = (Photino.NET.PhotinoWindow)sender;
                var hWnd = w.WindowHandle;
                int style = WindowDragger.GetWindowLong(hWnd, WindowDragger.GWL_STYLE);
                style |= WindowDragger.WS_MINIMIZEBOX | WindowDragger.WS_MAXIMIZEBOX | WindowDragger.WS_THICKFRAME;
                WindowDragger.SetWindowLong(hWnd, WindowDragger.GWL_STYLE, style);

                int useImmersiveDarkMode = 1;
                WindowDragger.DwmSetWindowAttribute(hWnd, WindowDragger.DWMWA_USE_IMMERSIVE_DARK_MODE, ref useImmersiveDarkMode, sizeof(int));
            }
        });

        window.WaitForClose();
    });

    if (System.Runtime.InteropServices.RuntimeInformation.IsOSPlatform(System.Runtime.InteropServices.OSPlatform.Windows))
    {
        windowThread.SetApartmentState(System.Threading.ApartmentState.STA);
    }
    
    windowThread.Start();
    windowThread.Join();

    // Gracefully stop the backend server when the window is closed
    await app.StopAsync();
}

public static class WindowDragger
{
    [System.Runtime.InteropServices.DllImport("user32.dll")]
    public static extern bool ReleaseCapture();

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    public static extern IntPtr DefWindowProc(IntPtr hWnd, uint uMsg, UIntPtr wParam, IntPtr lParam);

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    [return: System.Runtime.InteropServices.MarshalAs(System.Runtime.InteropServices.UnmanagedType.Bool)]
    public static extern bool IsZoomed(IntPtr hWnd);

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    public static extern int GetWindowLong(IntPtr hWnd, int nIndex);

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

    [System.Runtime.InteropServices.DllImport("dwmapi.dll")]
    public static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

    public const uint WM_SYSCOMMAND = 0x0112;
    public const uint MOUSE_MOVE = 0xF012;
    public const int SW_MAXIMIZE = 3;
    public const int SW_RESTORE = 9;
    
    public const int GWL_STYLE = -16;
    public const int WS_MINIMIZEBOX = 0x00020000;
    public const int WS_MAXIMIZEBOX = 0x00010000;
    public const int WS_THICKFRAME = 0x00040000;
    
    public const int DWMWA_USE_IMMERSIVE_DARK_MODE = 20;
}
