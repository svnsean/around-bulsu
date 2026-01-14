// Assets/Scripts/UI/NavigationHUD.cs
using UnityEngine;
using UnityEngine.UI;
using TMPro;

public class NavigationHUD : MonoBehaviour
{
    public static NavigationHUD Instance { get; private set; }

    [Header("UI References")]
    public TextMeshProUGUI distanceText;
    public TextMeshProUGUI buildingNameText;
    public TextMeshProUGUI instructionText;
    public GameObject hudPanel;

    [Header("Settings")]
    public string distanceFormat = "{0:F0}m";

    private string targetBuildingName;
    private double targetLat;
    private double targetLon;

    void Awake()
    {
        Instance = this;
    }

    void Start()
    {
        // Hide HUD initially
        if (hudPanel != null)
            hudPanel.SetActive(false);
    }

    public void StartNavigation(string buildingName, double lat, double lon)
    {
        targetBuildingName = buildingName;
        targetLat = lat;
        targetLon = lon;

        if (buildingNameText != null)
            buildingNameText.text = buildingName;

        if (hudPanel != null)
            hudPanel.SetActive(true);
    }

    public void StopNavigation()
    {
        if (hudPanel != null)
            hudPanel.SetActive(false);
    }

    void Update()
    {
        if (!GPSManager.Instance.IsReady) return;
        if (hudPanel == null || !hudPanel.activeSelf) return;

        // Calculate distance
        double distance = GPSManager.GetDistance(
            GPSManager.Instance.Latitude,
            GPSManager.Instance.Longitude,
            targetLat,
            targetLon
        );

        // Update distance text
        if (distanceText != null)
        {
            if (distance >= 1000)
            {
                distanceText.text = string.Format("{0:F1}km", distance / 1000);
            }
            else
            {
                distanceText.text = string.Format("{0:F0}m", distance);
            }
        }

        // Update instruction based on distance
        if (instructionText != null)
        {
            if (distance < 15)
            {
                instructionText.text = "You have arrived!";
            }
            else if (distance < 50)
            {
                instructionText.text = "Destination ahead";
            }
            else
            {
                instructionText.text = "Follow the arrow";
            }
        }
    }

    public void SetInstruction(string text)
    {
        if (instructionText != null)
            instructionText.text = text;
    }
}