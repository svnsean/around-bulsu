// Assets/Scripts/Core/ARNavigationController.cs
using UnityEngine;
using UnityEngine.XR.ARFoundation;
using System.Collections.Generic;
using TMPro;

public class ARNavigationController : MonoBehaviour
{
    public static ARNavigationController Instance { get; private set; }

    [Header("AR Components")]
    public ARSession arSession;
    public Transform xrOrigin;

    [Header("Prefabs")]
    public GameObject arrowPrefab;
    public GameObject destinationMarkerPrefab;
    public GameObject waypointPrefab;
    public GameObject turnSignPrefab;

    [Header("UI References")]
    public TextMeshProUGUI distanceText;
    public GameObject hudPanel;

    [Header("Navigation State")]
    private NavigationData currentNavData;
    private GameObject arrowInstance;
    private GameObject destinationInstance;
    private List<GameObject> waypointInstances = new List<GameObject>();
    private int currentWaypointIndex = 0;

    [Header("Settings")]
    public float arrivalThreshold = 15f;
    public float waypointReachThreshold = 10f;

    void Awake()
    {
        if (Instance == null)
        {
            Instance = this;
        }
        else
        {
            Destroy(gameObject);
        }
    }

    void Start()
    {
        // Start GPS and Compass
        if (GPSManager.Instance != null)
            StartCoroutine(GPSManager.Instance.StartGPS());
        if (CompassManager.Instance != null)
            StartCoroutine(CompassManager.Instance.StartCompass());

        // Hide HUD until navigation starts
        if (hudPanel != null)
            hudPanel.SetActive(false);
    }

    // Called from React Native Bridge
    public void StartNavigation(string jsonData)
    {
        Debug.Log($"[ARNav] Starting navigation with data: {jsonData}");

        try
        {
            currentNavData = JsonUtility.FromJson<NavigationData>(jsonData);
            currentWaypointIndex = 0;

            CreateNavigationElements();

            if (hudPanel != null)
                hudPanel.SetActive(true);
        }
        catch (System.Exception e)
        {
            Debug.LogError($"[ARNav] Failed to parse navigation data: {e.Message}");
        }
    }

    void CreateNavigationElements()
    {
        // Clear any existing elements
        ClearNavigationElements();

        // Create directional arrow
        if (arrowPrefab != null)
        {
            arrowInstance = Instantiate(arrowPrefab);
            arrowInstance.name = "NavigationArrow";
        }

        // Create destination marker
        if (destinationMarkerPrefab != null)
        {
            destinationInstance = Instantiate(destinationMarkerPrefab);
            destinationInstance.name = "DestinationMarker";

            var destAnchor = destinationInstance.GetComponent<GPSAnchor>();
            if (destAnchor == null)
                destAnchor = destinationInstance.AddComponent<GPSAnchor>();

            destAnchor.SetTarget(currentNavData.destLat, currentNavData.destLon);
        }

        // Create waypoint markers
        if (waypointPrefab != null && currentNavData.pathNodes != null)
        {
            foreach (var waypoint in currentNavData.pathNodes)
            {
                var wpObj = Instantiate(waypointPrefab);
                wpObj.name = "Waypoint";

                var wpAnchor = wpObj.GetComponent<GPSAnchor>();
                if (wpAnchor == null)
                    wpAnchor = wpObj.AddComponent<GPSAnchor>();

                wpAnchor.SetTarget(waypoint.lat, waypoint.lng);
                waypointInstances.Add(wpObj);
            }
        }

        Debug.Log($"[ARNav] Created {waypointInstances.Count} waypoints");
    }

    void ClearNavigationElements()
    {
        if (arrowInstance != null) Destroy(arrowInstance);
        if (destinationInstance != null) Destroy(destinationInstance);

        foreach (var wp in waypointInstances)
        {
            if (wp != null) Destroy(wp);
        }
        waypointInstances.Clear();
    }

    public void StopNavigation()
    {
        ClearNavigationElements();
        currentNavData = null;

        if (hudPanel != null)
            hudPanel.SetActive(false);

        // Notify React Native
        ReactNativeBridge.SendMessage("NavigationStopped", "");

        Debug.Log("[ARNav] Navigation stopped");
    }

    void Update()
    {
        if (currentNavData == null) return;
        if (GPSManager.Instance == null || !GPSManager.Instance.IsReady) return;

        UpdateDistanceDisplay();
        UpdateArrowDirection();
        CheckWaypointProgress();
        CheckArrival();
    }

    void UpdateDistanceDisplay()
    {
        if (distanceText == null) return;

        double distance = GPSManager.GetDistance(
            GPSManager.Instance.Latitude,
            GPSManager.Instance.Longitude,
            currentNavData.destLat,
            currentNavData.destLon
        );

        distanceText.text = $"{distance:F0}m";
    }

    void UpdateArrowDirection()
    {
        if (arrowInstance == null) return;
        if (CompassManager.Instance == null || !CompassManager.Instance.IsReady) return;

        // Point arrow toward current waypoint or destination
        double targetLat, targetLon;

        if (currentWaypointIndex < waypointInstances.Count)
        {
            var wpAnchor = waypointInstances[currentWaypointIndex].GetComponent<GPSAnchor>();
            targetLat = wpAnchor.targetLatitude;
            targetLon = wpAnchor.targetLongitude;
        }
        else
        {
            targetLat = currentNavData.destLat;
            targetLon = currentNavData.destLon;
        }

        double bearing = GPSManager.GetBearing(
            GPSManager.Instance.Latitude,
            GPSManager.Instance.Longitude,
            targetLat,
            targetLon
        );

        float compassHeading = CompassManager.Instance.TrueHeading;
        float relativeAngle = (float)(bearing - compassHeading);

        // Position arrow in front of camera
        Camera cam = Camera.main;
        arrowInstance.transform.position = cam.transform.position + cam.transform.forward * 3f;
        arrowInstance.transform.position = new Vector3(
            arrowInstance.transform.position.x,
            cam.transform.position.y - 0.5f,
            arrowInstance.transform.position.z
        );

        // Rotate arrow to point toward target
        arrowInstance.transform.rotation = Quaternion.Euler(0, relativeAngle, 0);
    }

    void CheckWaypointProgress()
    {
        if (currentWaypointIndex >= waypointInstances.Count) return;

        var currentWaypoint = waypointInstances[currentWaypointIndex].GetComponent<GPSAnchor>();
        double distance = GPSManager.GetDistance(
            GPSManager.Instance.Latitude,
            GPSManager.Instance.Longitude,
            currentWaypoint.targetLatitude,
            currentWaypoint.targetLongitude
        );

        if (distance < waypointReachThreshold)
        {
            // Hide passed waypoint
            waypointInstances[currentWaypointIndex].SetActive(false);
            currentWaypointIndex++;

            Debug.Log($"[ARNav] Reached waypoint {currentWaypointIndex}");
        }
    }

    void CheckArrival()
    {
        double distance = GPSManager.GetDistance(
            GPSManager.Instance.Latitude,
            GPSManager.Instance.Longitude,
            currentNavData.destLat,
            currentNavData.destLon
        );

        if (distance < arrivalThreshold)
        {
            OnArrived();
        }
    }

    void OnArrived()
    {
        Debug.Log($"[ARNav] Arrived at {currentNavData.buildingName}");

        // Notify React Native
        ReactNativeBridge.SendMessage("Arrived", currentNavData.buildingName);

        StopNavigation();
    }
}

// Data classes for JSON parsing
[System.Serializable]
public class NavigationData
{
    public string buildingName;
    public double destLat;
    public double destLon;
    public PathNode[] pathNodes;
}

[System.Serializable]
public class PathNode
{
    public double lat;
    public double lng;
}