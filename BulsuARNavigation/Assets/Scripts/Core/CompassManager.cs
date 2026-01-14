// Assets/Scripts/Core/CompassManager.cs
using UnityEngine;
using System.Collections;

public class CompassManager : MonoBehaviour
{
    public static CompassManager Instance { get; private set; }

    public float TrueHeading { get; private set; }
    public float MagneticHeading { get; private set; }
    public bool IsReady { get; private set; }

    [Header("Smoothing")]
    [SerializeField] private float smoothingFactor = 0.1f;

    private float smoothedHeading;

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

    public IEnumerator StartCompass()
    {
        // Check if compass is supported
        if (!Input.compass.enabled)
        {
            Input.compass.enabled = true;
        }

        // Wait for compass to initialize
        yield return new WaitForSeconds(1f);

        // Start location for true heading (requires GPS)
        if (!Input.location.isEnabledByUser)
        {
            Input.location.Start();
            yield return new WaitForSeconds(1f);
        }

        IsReady = true;
        Debug.Log("Compass Started Successfully");
        StartCoroutine(UpdateLoop());
    }

    IEnumerator UpdateLoop()
    {
        while (true)
        {
            if (Input.compass.enabled)
            {
                MagneticHeading = Input.compass.magneticHeading;
                TrueHeading = Input.compass.trueHeading;

                // Apply smoothing to reduce jitter
                float targetHeading = TrueHeading > 0 ? TrueHeading : MagneticHeading;
                smoothedHeading = SmoothAngle(smoothedHeading, targetHeading, smoothingFactor);
                TrueHeading = smoothedHeading;
            }

            yield return null; // Update every frame for smooth compass
        }
    }

    // Smooth angle interpolation (handles 0/360 wraparound)
    private float SmoothAngle(float current, float target, float factor)
    {
        float delta = Mathf.DeltaAngle(current, target);
        return Mathf.Repeat(current + delta * factor, 360f);
    }

    void OnDestroy()
    {
        Input.compass.enabled = false;
    }
}