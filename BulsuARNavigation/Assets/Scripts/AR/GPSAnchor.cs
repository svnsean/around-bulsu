// Assets/Scripts/AR/GPSAnchor.cs
using UnityEngine;

public class GPSAnchor : MonoBehaviour
{
    [Header("GPS Target Coordinates")]
    public double targetLatitude;
    public double targetLongitude;

    [Header("Render Settings")]
    public float maxRenderDistance = 200f;
    public float scaleFalloffStart = 50f;
    public float minScale = 0.3f;
    public float heightOffset = 0f;

    [Header("Debug")]
    public bool showDebugInfo = false;

    private Camera arCamera;
    private double currentDistance;

    void Start()
    {
        arCamera = Camera.main;
    }

    void Update()
    {
        if (GPSManager.Instance == null || !GPSManager.Instance.IsReady) return;
        if (CompassManager.Instance == null || !CompassManager.Instance.IsReady) return;

        UpdatePosition();
    }

    void UpdatePosition()
    {
        double userLat = GPSManager.Instance.Latitude;
        double userLon = GPSManager.Instance.Longitude;

        // Calculate distance and bearing to target
        currentDistance = GPSManager.GetDistance(userLat, userLon, targetLatitude, targetLongitude);
        double bearing = GPSManager.GetBearing(userLat, userLon, targetLatitude, targetLongitude);

        // Calculate relative angle (bearing minus compass heading)
        float compassHeading = CompassManager.Instance.TrueHeading;
        float relativeAngle = (float)(bearing - compassHeading);

        // Convert to radians
        float angleRad = relativeAngle * Mathf.Deg2Rad;

        // Calculate direction vector
        Vector3 direction = new Vector3(
            Mathf.Sin(angleRad),
            0,
            Mathf.Cos(angleRad)
        );

        // Position at a fixed distance in AR space (max 30m for visibility)
        float arDistance = Mathf.Min((float)currentDistance, 30f);
        Vector3 targetPosition = arCamera.transform.position + direction * arDistance;
        targetPosition.y = arCamera.transform.position.y + heightOffset;

        transform.position = targetPosition;

        // Scale based on real-world distance
        float scale = 1f;
        if (currentDistance > scaleFalloffStart)
        {
            float falloff = Mathf.InverseLerp(scaleFalloffStart, maxRenderDistance, (float)currentDistance);
            scale = Mathf.Lerp(1f, minScale, falloff);
        }
        transform.localScale = Vector3.one * scale;

        // Face the camera (billboard effect)
        Vector3 lookDir = arCamera.transform.position - transform.position;
        lookDir.y = 0; // Keep upright
        if (lookDir != Vector3.zero)
        {
            transform.rotation = Quaternion.LookRotation(-lookDir);
        }

        // Hide if too far
        gameObject.SetActive(currentDistance <= maxRenderDistance);
    }

    public void SetTarget(double lat, double lon)
    {
        targetLatitude = lat;
        targetLongitude = lon;
    }

    public double GetDistance()
    {
        return currentDistance;
    }

    void OnGUI()
    {
        if (showDebugInfo && Application.isEditor)
        {
            GUI.Label(new Rect(10, 10, 300, 20), $"Distance: {currentDistance:F1}m");
            GUI.Label(new Rect(10, 30, 300, 20), $"Target: {targetLatitude:F6}, {targetLongitude:F6}");
        }
    }
}