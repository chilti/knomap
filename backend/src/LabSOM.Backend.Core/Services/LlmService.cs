using System;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace LabSOM.Backend.Core.Services
{
    public class LlmService
    {
        private readonly HttpClient _httpClient;

        public LlmService()
        {
            // Initialize custom HttpClient that ignores SSL errors for LM Studio
            var handler = new HttpClientHandler
            {
                ServerCertificateCustomValidationCallback = (message, cert, chain, sslPolicyErrors) => true
            };
            _httpClient = new HttpClient(handler);
        }

        private (string baseUrl, string model, string user, string password) GetConfig()
        {
            var baseUrl = Environment.GetEnvironmentVariable("LLM_BASE_URL");
            var model = Environment.GetEnvironmentVariable("LLM_MODEL");
            var user = Environment.GetEnvironmentVariable("LLM_USER");
            var password = Environment.GetEnvironmentVariable("LLM_PASSWORD");

            // If any critical var is missing, search for .env file directly on disk
            if (string.IsNullOrEmpty(baseUrl) || string.IsNullOrEmpty(user) || string.IsNullOrEmpty(password))
            {
                var searchDir = new DirectoryInfo(AppContext.BaseDirectory);
                while (searchDir != null)
                {
                    var envFile = Path.Combine(searchDir.FullName, ".env");
                    if (File.Exists(envFile))
                    {
                        foreach (var line in File.ReadAllLines(envFile))
                        {
                            var trimmed = line.Trim();
                            if (trimmed.StartsWith("#") || !trimmed.Contains("=")) continue;
                            var parts = trimmed.Split('=', 2);
                            var key = parts[0].Trim();
                            var val = parts[1].Trim();
                            if (key == "LLM_BASE_URL" && string.IsNullOrEmpty(baseUrl)) baseUrl = val;
                            if (key == "LLM_MODEL" && string.IsNullOrEmpty(model)) model = val;
                            if (key == "LLM_USER" && string.IsNullOrEmpty(user)) user = val;
                            if (key == "LLM_PASSWORD" && string.IsNullOrEmpty(password)) password = val;
                        }
                        break;
                    }
                    searchDir = searchDir.Parent;
                }
            }

            baseUrl = string.IsNullOrEmpty(baseUrl) ? "https://dinamica1.fciencias.unam.mx/lmstudio/v1/" : baseUrl;
            model = string.IsNullOrEmpty(model) ? "openai/gpt-oss-20b" : model;

            return (baseUrl, model, user ?? "", password ?? "");
        }

        public async Task<string> AnalyzeAsync(string systemPrompt, string userPrompt)
        {
            var config = GetConfig();
            var url = config.baseUrl.TrimEnd('/') + "/chat/completions";

            var payload = new
            {
                model = config.model,
                messages = new[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = userPrompt }
                },
                temperature = 0.2
            };

            var jsonPayload = JsonSerializer.Serialize(payload);
            using var request = new HttpRequestMessage(HttpMethod.Post, url);
            request.Content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

            if (!string.IsNullOrEmpty(config.user) && !string.IsNullOrEmpty(config.password))
            {
                var credentials = $"{config.user}:{config.password}";
                var encodedCredentials = Convert.ToBase64String(Encoding.UTF8.GetBytes(credentials));
                request.Headers.Authorization = new AuthenticationHeaderValue("Basic", encodedCredentials);
            }

            var response = await _httpClient.SendAsync(request);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                throw new Exception($"LLM Request Failed ({response.StatusCode}) [User: {config.user}]: {error}");
            }

            var responseJson = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(responseJson);
            
            if (doc.RootElement.TryGetProperty("choices", out var choices) && choices.GetArrayLength() > 0)
            {
                var firstChoice = choices[0];
                if (firstChoice.TryGetProperty("message", out var message) && message.TryGetProperty("content", out var textContent))
                {
                    return textContent.GetString() ?? "";
                }
            }

            return "Error: Could not parse response from LLM.";
        }
    }
}
