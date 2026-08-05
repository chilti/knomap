using System;
using System.IO;
using System.Text.Json;
using System.Collections.Generic;

public class InCitesResult
{
    public bool Success { get; set; } = true;
    public string Error { get; set; } = """";
    public Dictionary<string, object> Units { get; set; }
}

public class Program
{
    public static void Main()
    {
        try {
            string json = File.ReadAllText(""test_output.json"");
            var options = new JsonSerializerOptions {
                PropertyNameCaseInsensitive = true,
                NumberHandling = System.Text.Json.Serialization.JsonNumberHandling.AllowNamedFloatingPointLiterals
            };
            var result = JsonSerializer.Deserialize<InCitesResult>(json, options);
            Console.WriteLine(""Success: "" + result.Success);
            Console.WriteLine(""Units count: "" + (result.Units != null ? result.Units.Count : 0));
        } catch (Exception ex) {
            Console.WriteLine(""Error: "" + ex.Message);
        }
    }
}
