// Assets/Scripts/AR/ARObjectPlacer.cs
using UnityEngine;
using UnityEngine.XR.ARFoundation;
using System.Collections.Generic;

public class ARObjectPlacer : MonoBehaviour
{
    public static ARObjectPlacer Instance { get; private set; }

    [Header("AR References")]
    public ARRaycastManager raycastManager;
    public ARPlaneManager planeManager;

    [Header("Settings")]
    public float groundOffset = 0f; // How high above detected ground
    public bool useARPlanes = false; // If true, place on detected planes; if false, use camera height

    private Camera arCamera;
    private List<ARRaycastHit> raycastHits = new List<ARRaycastHit>();

    void Awake()
    {
        Instance = this;
    }

    void Start()
    {
        arCamera = Camera.main;
    }

    /// <summary>
    /// Gets the ground Y position at a given world position
    /// </summary>
    public float GetGroundY(Vector3 worldPosition)
    {
        if (useARPlanes && raycastManager != null)
        {
            // Try to raycast down to find AR plane
            Ray ray = new Ray(worldPosition + Vector3.up * 10f, Vector3.down);
            if (raycastManager.Raycast(ray, raycastHits, UnityEngine.XR.ARSubsystems.TrackableType.PlaneWithinPolygon))
            {
                return raycastHits[0].pose.position.y + groundOffset;
            }
        }

        // Fallback: use camera's Y position as ground reference
        if (arCamera != null)
        {
            return arCamera.transform.position.y - 1.5f + groundOffset; // Assume camera is ~1.5m above ground
        }

        return groundOffset;
    }

    /// <summary>
    /// Places a GameObject at a GPS position relative to the camera
    /// </summary>
    public void PlaceAtGPSPosition(GameObject obj, double targetLat, double targetLon, float heightAboveGround = 0f)
    {
        if (!GPSManager.Instance.IsReady || arCamera == null) return;

        double userLat = GPSManager.Instance.Latitude;
        double userLon = GPSManager.Instance.Longitude;

        // Calculate distance and bearing
        double distance = GPSManager.GetDistance(userLat, userLon, targetLat, targetLon);
        double bearing = GPSManager.GetBearing(userLat, userLon, targetLat, targetLon);

        // Get compass heading
        float compassHeading = CompassManager.Instance != null ? CompassManager.Instance.TrueHeading : 0f;
        float relativeAngle = (float)(bearing - compassHeading);
        float angleRad = relativeAngle * Mathf.Deg2Rad;

        // Calculate direction
        Vector3 direction = new Vector3(
            Mathf.Sin(angleRad),
            0,
            Mathf.Cos(angleRad)
        );

        // Clamp distance for AR visibility
        float displayDistance = Mathf.Min((float)distance, 50f);

        // Calculate position
        Vector3 targetPosition = arCamera.transform.position + direction * displayDistance;

        // Set ground Y
        targetPosition.y = GetGroundY(targetPosition) + heightAboveGround;

        obj.transform.position = targetPosition;
    }

    /// <summary>
    /// Places an object directly in front of the camera at a distance
    /// </summary>
    public void PlaceInFrontOfCamera(GameObject obj, float distance, float heightAboveGround = 1f)
    {
        if (arCamera == null) return;

        Vector3 forward = arCamera.transform.forward;
        forward.y = 0; // Keep on horizontal plane
        forward.Normalize();

        Vector3 position = arCamera.transform.position + forward * distance;
        position.y = GetGroundY(position) + heightAboveGround;

        obj.transform.position = position;
    }

    /// <summary>
    /// Makes an object face the camera (billboard)
    /// </summary>
    public void FaceCamera(GameObject obj, bool lockYAxis = true)
    {
        if (arCamera == null) return;

        if (lockYAxis)
        {
            // Only rotate around Y axis
            Vector3 lookPos = arCamera.transform.position;
            lookPos.y = obj.transform.position.y;
            obj.transform.LookAt(lookPos);
            obj.transform.Rotate(0, 180, 0);
        }
        else
        {
            // Full billboard
            obj.transform.LookAt(arCamera.transform);
            obj.transform.Rotate(0, 180, 0);
        }
    }
}