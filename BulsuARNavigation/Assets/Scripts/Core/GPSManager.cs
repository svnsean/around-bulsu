// Assets/Scripts/Core/GPSManager.cs
using UnityEngine;
using System;
using System.Collections;

public class GPSManager : MonoBehaviour
{
    public static GPSManager Instance { get; private set; }

    public double Latitude { get; private set; }
    public double Longitude { get; private set; }
    public float Accuracy { get; private set; }
    public bool IsReady { get; private set; }

    public event Action<double, double> OnLocationUpdated;

    void Awake()
    {
        if (Instance == null)
        {
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }
        else
        {
            Destroy(gameObject);
        }
    }

    public IEnumerator StartGPS()
    {
        // Check if user has location service enabled
        if (!Input.location.isEnabledByUser)
        {
            Debug.LogError("GPS not enabled by user");
            yield break;
        }

        // Start location service with high accuracy
        Input.location.Start(1f, 1f);

        // Wait for initialization
        int maxWait = 20;
        while (Input.location.status == LocationServiceStatus.Initializing && maxWait > 0)
        {
            yield return new WaitForSeconds(1);
            maxWait--;
        }

        // Check if timed out
        if (maxWait < 1)
        {
            Debug.LogError("GPS initialization timed out");
            yield break;
        }

        // Check if failed
        if (Input.location.status == LocationServiceStatus.Failed)
        {
            Debug.LogError("Unable to determine device location");
            yield break;
        }

        // GPS is running
        IsReady = true;
        Debug.Log("GPS Started Successfully");
        StartCoroutine(UpdateLoop());
    }

    IEnumerator UpdateLoop()
    {
        while (true)
        {
            if (Input.location.status == LocationServiceStatus.Running)
            {
                Latitude = Input.location.lastData.latitude;
                Longitude = Input.location.lastData.longitude;
                Accuracy = Input.location.lastData.horizontalAccuracy;

                OnLocationUpdated?.Invoke(Latitude, Longitude);
            }

            yield return new WaitForSeconds(0.5f);
        }
    }

    void OnDestroy()
    {
        Input.location.Stop();
    }

    // Haversine distance calculation (returns meters)
    public static double GetDistance(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6371e3; // Earth radius in meters
        double p1 = lat1 * Mathf.Deg2Rad;
        double p2 = lat2 * Mathf.Deg2Rad;
        double dp = (lat2 - lat1) * Mathf.Deg2Rad;
        double dl = (lon2 - lon1) * Mathf.Deg2Rad;

        double a = Math.Sin(dp / 2) * Math.Sin(dp / 2) +
                   Math.Cos(p1) * Math.Cos(p2) *
                   Math.Sin(dl / 2) * Math.Sin(dl / 2);
        double c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));

        return R * c;
    }

    // Bearing calculation (returns degrees 0-360)
    public static double GetBearing(double lat1, double lon1, double lat2, double lon2)
    {
        double p1 = lat1 * Mathf.Deg2Rad;
        double p2 = lat2 * Mathf.Deg2Rad;
        double dl = (lon2 - lon1) * Mathf.Deg2Rad;

        double y = Math.Sin(dl) * Math.Cos(p2);
        double x = Math.Cos(p1) * Math.Sin(p2) - Math.Sin(p1) * Math.Cos(p2) * Math.Cos(dl);
        double bearing = Math.Atan2(y, x) * Mathf.Rad2Deg;

        return (bearing + 360) % 360;
    }
}