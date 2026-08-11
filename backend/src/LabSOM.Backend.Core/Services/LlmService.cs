using System;
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
        private readonly string _baseUrl;
        private readonly string _model;

        public LlmService()
        {
            // Initialize custom HttpClient that ignores SSL errors for LM Studio
            var handler = new HttpClientHandler
            {
                ServerCertificateCustomValidationCallback = (message, cert, chain, sslPolicyErrors) => true
            };
            _httpClient = new HttpClient(handler);

            _baseUrl = Environment.GetEnvironmentVariable("LLM_BASE_URL") ?? "https://dinamica1.fciencias.unam.mx/lmstudio/v1/";
            _model = Environment.GetEnvironmentVariable("LLM_MODEL") ?? "openai/gpt-oss-20b";
            var user = Environment.GetEnvironmentVariable("LLM_USER");
            var password = Environment.GetEnvironmentVariable("LLM_PASSWORD");

            // Authorization: Nginx basic auth
            if (!string.IsNullOrEmpty(user) && !string.IsNullOrEmpty(password))
            {
                var credentials = $"{user}:{password}";
                var encodedCredentials = Convert.ToBase64String(Encoding.UTF8.GetBytes(credentials));
                _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", encodedCredentials);
            }
            else
            {
                // Fallback to the known working token from test.py
                var fallbackToken = "cmFnX2FwaTplYTAyMzhjMTMyNDUwNTFhY2RmY2FkMGNmMWJkNTliN2NkMDhkOThhNmMwODRmMmUzYWZmNjM5YWVjZWY4Mjcz";
                _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", fallbackToken);
            }
        }

        public async Task<string> AnalyzeAsync(string systemPrompt, string userPrompt)
        {
            var url = _baseUrl.TrimEnd('/') + "/chat/completions";

            var payload = new
            {
                model = _model,
                messages = new[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = userPrompt }
                },
                temperature = 0.2
            };

            var jsonPayload = JsonSerializer.Serialize(payload);
            var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync(url, content);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                throw new Exception($"LLM Request Failed: {response.StatusCode} - {error}");
            }

            var responseJson = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(responseJson);
            
            if (doc.RootElement.TryGetProperty("choices", out var choices) && choices.GetArrayLength() > 0)
            {
                var firstChoice = choices[0];
                if (firstChoice.TryGetProperty("message", out var message) && message.TryGetProperty("content", out var textContent))
                {
                    return textContent.GetString();
                }
            }

            return "Error: Could not parse response from LLM.";
        }
    }
}
